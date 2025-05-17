import { Editor, MarkdownView, Notice, Plugin } from "obsidian";
import { DatePickerSettings, DEFAULT_SETTINGS, DateRange } from "./types/types";
import { CalendarPopup } from "./components/CalendarPopup";
import { DatePickerSettingTab } from "./components/SettingsTab";

export default class DatePickerPlugin extends Plugin {
  settings: DatePickerSettings;
  private lastKeyTime = 0;
  private lastKeyChar = "";

  async onload() {
    await this.loadSettings();

    this.registerDateInteractions();
    this.registerLiveDateEvaluation();
    this.registerAtomicDateBehavior();
    this.registerDirectTrigger();

    this.addCommand({
      id: "insert-date",
      name: "Insert date at cursor position",
      editorCallback: (editor: Editor) => {
        this.openDatePicker(editor);
      },
    });

    this.addRibbonIcon("calendar", "Insert Date", () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        this.openDatePicker(view.editor);
      } else {
        new Notice("No active markdown editor found");
      }
    });

    this.addSettingTab(new DatePickerSettingTab(this.app, this));
  }

  openDatePicker(editor: Editor) {
    let cursorCoords = null;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const cursor = editor.getCursor();
    
    if (view) {
      try {
        const cmEditor = (view.editor as any).cm;
        if (cmEditor?.coordsAtPos) {
          cursorCoords = cmEditor.coordsAtPos(cmEditor.state.selection.main.head);
        }
      } catch (e) {
        console.log("CM6 positioning failed, using fallback");
      }
      
      if (!cursorCoords) {
        const editorElement = (view.editor as any).containerEl;
        const editorRect = editorElement.getBoundingClientRect();
        const lineHeight = editorRect.height / Math.max(editor.lineCount(), 1);
        
        cursorCoords = {
          top: editorRect.top + cursor.line * lineHeight,
          left: editorRect.left + cursor.ch * 8,
          bottom: editorRect.top + (cursor.line + 1) * lineHeight,
          right: editorRect.left + (cursor.ch + 1) * 8
        };
      }
    }

    const calendarPopup = new CalendarPopup(this.app, this, (date) => {
      editor.replaceRange(date + " ", cursor);
      
      if (date.includes("<span")) {
        const currentLine = editor.getLine(cursor.line);
        const closingTagPos = currentLine.indexOf("</span>", cursor.ch);
        
        editor.focus();
        setTimeout(() => {
          editor.setCursor({
            line: cursor.line,
            ch: closingTagPos > -1 ? closingTagPos + 8 : cursor.ch + date.length + 1
          });
        }, 10);
      } else {
        editor.setCursor({
          line: cursor.line,
          ch: cursor.ch + date.length + 1
        });
      }
    });

    calendarPopup.open();
    if (cursorCoords) {
      calendarPopup.positionNearCoords(cursorCoords);
    }
  }

  registerDirectTrigger() {
    this.registerDomEvent(document, "keydown", (evt: KeyboardEvent) => {
      if (evt.key === "\\") {
        const now = Date.now();
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
          this.lastKeyChar = "";
          return;
        }

        const editor = view.editor;

        if (this.lastKeyChar === "\\" && now - this.lastKeyTime < 500) {
          console.log("Double slash detected");
          evt.preventDefault();

          const cursor = editor.getCursor();
          editor.replaceRange(
            "",
            { line: cursor.line, ch: cursor.ch - 1 },
            cursor
          );

          this.openDatePicker(editor);
          this.lastKeyTime = 0;
          this.lastKeyChar = "";
        } else {
          this.lastKeyTime = now;
          this.lastKeyChar = "\\";
        }
      } else {
        this.lastKeyChar = "";
      }
    });
  }

  registerDateInteractions() {
    this.registerDomEvent(document, "click", (evt: MouseEvent) => {
      const target = evt.target as HTMLElement;
      const dateSpan = target.matches(".styled-date")
        ? (target as HTMLElement)
        : (target.closest(".styled-date:not(.styled-date .styled-date>*)") as HTMLElement | null);

      if (dateSpan) {
        const dateAttr = dateSpan.getAttribute("data-date") ?? "";

        try {
          let date: Date;
          if (dateAttr) {
            date = new Date(dateAttr);
          } else {
            return;
          }

          if (isNaN(date.getTime())) return;

          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (view?.editor) {
            const originalIso = dateAttr;

            const calendarPopup = new CalendarPopup(this.app, this, (newDateHtml) => {
              const plainText = newDateHtml.replace(/<[^>]+>/g, "");
              this.replaceDateInEditor(view.editor, originalIso, plainText);
            });

            calendarPopup.selectedDate = date;
            calendarPopup.currentMonth = date.getMonth();
            calendarPopup.currentYear = date.getFullYear();

            calendarPopup.open();
            calendarPopup.positionNearCoords({
              left: evt.clientX,
              top: evt.clientY,
            });

            evt.stopPropagation();
            evt.preventDefault();
          }
        } catch (e) {
          console.error("Error parsing date:", e);
        }
      }
    });

    const styleEl = document.createElement("style");
    styleEl.id = "date-hover-styles";
    document.head.appendChild(styleEl);
    styleEl.textContent = `
      .styled-date {
        cursor: pointer;
        transition: transform 0.1s ease, box-shadow 0.1s ease;
        display: inline-block;
        line-height: 1;
        vertical-align: baseline;
        padding: 0.1em 0.2em;
        margin: -0.1em 0;
        background-color: var(--background-secondary);
        border-radius: 3px;
      }
      
      .styled-date:hover {
        transform: scale(1.05);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .styled-date.date-urgent {
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
      }

      .styled-date.date-neutral {
        background-color: var(--background-secondary);
      }

      .calendar-popup {
        position: fixed;
        z-index: 100;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        padding: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }

      .calendar-days-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
        margin-top: 4px;
      }

      .calendar-days-grid div {
        text-align: center;
        padding: 4px;
        cursor: pointer;
        border-radius: 3px;
      }

      .calendar-days-grid div:hover {
        background-color: var(--background-modifier-hover);
      }

      .calendar-days-grid div.selected {
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
      }

      .calendar-days-grid div.today {
        border: 1px solid var(--interactive-accent);
      }

      .calendar-days-grid div.keyboard-focused {
        background-color: var(--background-modifier-hover);
        outline: 2px solid var(--interactive-accent);
      }
    `;
  }

  replaceDateInEditor(editor: Editor, oldIsoDate: string, newDateText: string) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;

    const content = editor.getValue();
    const newIso = this.getISODate(newDateText);
    const replacement = `<span class="styled-date" data-date="${newIso}">${newDateText}</span>`;

    const cursor = editor.getCursor();
    const cursorOffset = editor.posToOffset(cursor);

    const pattern = new RegExp(
      `<span class="styled-date"[^>]*data-date=["']${this.escapeRegExp(oldIsoDate)}["'][^>]*>.*?<\\/span>`,
      "g"
    );

    let match;
    const matches = [];
    while ((match = pattern.exec(content)) !== null) {
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;
      
      const distance = Math.abs(cursorOffset - startOffset);
      
      matches.push({
        text: match[0],
        startOffset,
        endOffset,
        startPos: editor.offsetToPos(startOffset),
        endPos: editor.offsetToPos(endOffset),
        distance
      });
    }

    if (matches.length === 0) {
      console.log("No matching date span found for ISO:", oldIsoDate);
      return;
    }

    matches.sort((a, b) => a.distance - b.distance);
    const targetMatch = matches[0];

    editor.transaction({
      changes: [{
        from: targetMatch.startPos,
        to: targetMatch.endPos,
        text: replacement
      }]
    });
  }

  escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  parseDateFromString(dateStr: string): Date {
    const format = this.settings.format;
    const parts = dateStr.split(/[-/.]/);
    
    if (parts.length !== 3) {
      return new Date(dateStr);
    }

    try {
      let year = 0, month = 0, day = 0;
      
      const formatMap = {
        YYYY: format.indexOf("YYYY"),
        MM: format.indexOf("MM"),
        DD: format.indexOf("DD")
      };
      
      const order = Object.entries(formatMap)
        .sort(([,a], [,b]) => a - b)
        .map(([key]) => key);
      
      order.forEach((type, index) => {
        const value = parseInt(parts[index]);
        switch(type) {
          case 'YYYY': year = value; break;
          case 'MM': month = value - 1; break;
          case 'DD': day = value; break;
        }
      });

      return new Date(year, month, day);
    } catch (e) {
      console.error("Error parsing date string:", e);
      return new Date();
    }
  }

  getISODate(dateText: string): string {
    try {
      const format = this.settings.format;

      if (format === "YYYY-MM-DD") {
        return dateText;
      }

      if (format === "MM/DD/YYYY") {
        const parts = dateText.split("/");
        if (parts.length === 3) {
          return `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
        }
      }

      if (format === "DD/MM/YYYY") {
        const parts = dateText.split("/");
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }

      return dateText;
    } catch (e) {
      console.error("Error converting to ISO date:", e);
      return dateText;
    }
  }

  getDateUrgency(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const isToday = targetDate.getTime() === today.getTime();
    return isToday ? "urgent" : "neutral";
  }

  registerLiveDateEvaluation() {
    this.registerMarkdownPostProcessor((el, ctx) => {
      const dateSpans = el.querySelectorAll(".styled-date");

      dateSpans.forEach((span) => {
        const dataDate = span.getAttribute("data-date");
        if (!dataDate) return;

        try {
          const date = new Date(dataDate);
          if (isNaN(date.getTime())) return;

          const urgency = this.getDateUrgency(date);
          span.classList.remove("date-neutral", "date-warning", "date-urgent");
          span.classList.add(`date-${urgency}`);
        } catch (e) {
          console.error("Error evaluating date:", e);
        }
      });
    });
  }

  registerAtomicDateBehavior() {
    let isDateHighlighted = false;
    let highlightedDateRange: DateRange | null = null;
    
    const findDateSpans = (line: string): {text: string, startCh: number, endCh: number}[] => {
      const dateSpans: {text: string, startCh: number, endCh: number}[] = [];
      const dateSpanRegex = /<span class="styled-date"[^>]*>.*?<\/span>/g;
      let match: RegExpExecArray | null;
      
      while ((match = dateSpanRegex.exec(line)) !== null) {
        dateSpans.push({
          text: match[0],
          startCh: match.index,
          endCh: match.index + match[0].length
        });
      }
      
      return dateSpans.sort((a, b) => a.startCh - b.startCh);
    };
    
    const handleDateSelection = (editor: Editor, span: {text: string, startCh: number, endCh: number}, line: number) => {
      editor.setSelection(
        { line, ch: span.startCh },
        { line, ch: span.endCh }
      );
      
      isDateHighlighted = true;
      highlightedDateRange = {
        from: { line, ch: span.startCh },
        to: { line, ch: span.endCh },
        text: span.text
      };
    };
    
    const clearHighlight = () => {
      isDateHighlighted = false;
      highlightedDateRange = null;
    };
    
    this.registerDomEvent(document, "keydown", (evt: KeyboardEvent) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view?.editor) return;
      
      const editor = view.editor;
      const cursor = editor.getCursor();
      const selection = editor.getSelection();
      
      if (evt.key === "Backspace" && !selection) {
        const line = editor.getLine(cursor.line);
        const beforeCursor = line.substring(0, cursor.ch);
        const dateSpans = findDateSpans(beforeCursor);
        
        const lastSpan = dateSpans.find(span => span.endCh === cursor.ch);
        if (lastSpan) {
          evt.preventDefault();
          editor.setSelection(
            { line: cursor.line, ch: lastSpan.startCh },
            { line: cursor.line, ch: cursor.ch }
          );
        }
        return;
      }
      
      if (["ArrowLeft", "ArrowRight"].includes(evt.key)) {
        const line = editor.getLine(cursor.line);
        const dateSpans = findDateSpans(line);
        
        if (isDateHighlighted && highlightedDateRange) {
          const { from, to } = highlightedDateRange;
          if ((evt.key === "ArrowLeft" && cursor.line === from.line && cursor.ch === from.ch) ||
              (evt.key === "ArrowRight" && cursor.line === to.line && cursor.ch === to.ch)) {
            clearHighlight();
            return;
          }
        }
        
        for (const span of dateSpans) {
          const isCursorAtStart = cursor.ch === span.startCh;
          const isCursorAtEnd = cursor.ch === span.endCh;
          const isCursorWithin = cursor.ch > span.startCh && cursor.ch < span.endCh;
          
          if ((isCursorAtStart || isCursorAtEnd || isCursorWithin) && !isDateHighlighted) {
            evt.preventDefault();
            handleDateSelection(editor, span, cursor.line);
            return;
          }
          
          if ((isCursorAtStart || isCursorAtEnd) && isDateHighlighted) {
            evt.preventDefault();
            editor.setCursor({
              line: cursor.line,
              ch: evt.key === "ArrowLeft" ? span.startCh - 1 : span.endCh + 1
            });
            clearHighlight();
            return;
          }
        }
        
        if (selection) clearHighlight();
      }
      
      if (evt.key === "Escape" && isDateHighlighted) {
        clearHighlight();
      }
    });
    
    this.registerDomEvent(document, "click", (evt: MouseEvent) => {
      const target = evt.target as HTMLElement;
      if (!target.matches(".styled-date") && !target.closest(".styled-date")) {
        clearHighlight();
      }
    });
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
} 