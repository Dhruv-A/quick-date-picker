import { App } from "obsidian";
import DatePickerPlugin from "../main";

export class CalendarPopup {
  app: App;
  plugin: DatePickerPlugin;
  onChoose: (date: string) => void;
  containerEl: HTMLElement;
  selectedDate: Date;
  currentMonth: number;
  currentYear: number;
  focusedDay: number | null = null;
  focusedMonth: number;
  focusedYear: number;

  constructor(app: App, plugin: DatePickerPlugin, onChoose: (date: string) => void) {
    this.app = app;
    this.plugin = plugin;
    this.onChoose = onChoose;

    const now = new Date();
    this.selectedDate = now;
    this.currentMonth = now.getMonth();
    this.currentYear = now.getFullYear();
    this.focusedMonth = now.getMonth();
    this.focusedYear = now.getFullYear();

    this.containerEl = document.createElement("div");
    this.containerEl.addClass("calendar-popup");
    this.containerEl.tabIndex = -1;
    document.body.appendChild(this.containerEl);

    this.containerEl.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        this.handleKeyDown(e);
      }
    }, true);

    this.render();

    document.addEventListener("click", this.handleOutsideClick);
  }

  handleKeyDown = (e: KeyboardEvent) => {
    if (!document.body.contains(this.containerEl)) return;

    switch (e.key) {
      case "Escape":
        this.close();
        break;
      case "Enter":
        if (this.focusedDay !== null) {
          this.selectedDate = new Date(this.focusedYear, this.focusedMonth, this.focusedDay);
          this.close();
          this.onChoose(this.formatDate());
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        e.stopPropagation();
        this.moveFocus(-1, 0);
        break;
      case "ArrowRight":
        e.preventDefault();
        e.stopPropagation();
        this.moveFocus(1, 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        this.moveFocus(0, -1);
        break;
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        this.moveFocus(0, 1);
        break;
    }
  };

  moveFocus(dx: number, dy: number) {
    const daysInMonth = new Date(this.focusedYear, this.focusedMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(this.focusedYear, this.focusedMonth, 1).getDay();
    const firstDay = this.plugin.settings.firstDayOfWeek;
    
    let currentPos = 0;
    if (this.focusedDay !== null) {
      currentPos = firstDayOfMonth - firstDay + this.focusedDay - 1;
    }
    
    let newPos = currentPos + dx + (dy * 7);
    
    if (newPos < 0) {
      if (this.focusedMonth === 0) {
        this.focusedMonth = 11;
        this.focusedYear--;
      } else {
        this.focusedMonth--;
      }
      const prevMonthDays = new Date(this.focusedYear, this.focusedMonth + 1, 0).getDate();
      newPos = prevMonthDays + newPos;
      this.render();
    } else if (newPos >= 42) {
      if (this.focusedMonth === 11) {
        this.focusedMonth = 0;
        this.focusedYear++;
      } else {
        this.focusedMonth++;
      }
      newPos = newPos - 42;
      this.render();
    }
    
    const newDay = newPos - (firstDayOfMonth - firstDay) + 1;
    if (newDay > 0 && newDay <= daysInMonth) {
      this.focusedDay = newDay;
      this.updateFocus();
    }
  }

  updateFocus() {
    this.containerEl.querySelectorAll('.calendar-days-grid div').forEach(el => {
      el.classList.remove('keyboard-focused');
    });
    
    if (this.focusedDay !== null) {
      const dayElements = this.containerEl.querySelectorAll('.calendar-days-grid div');
      const firstDayOfMonth = new Date(this.focusedYear, this.focusedMonth, 1).getDay();
      const firstDay = this.plugin.settings.firstDayOfWeek;
      const offset = firstDayOfMonth - firstDay;
      const index = offset + this.focusedDay - 1;
      
      if (dayElements[index]) {
        dayElements[index].classList.add('keyboard-focused');
        dayElements[index].scrollIntoView({ block: 'nearest' });
      }
    }
  }

  render() {
    this.containerEl.empty();

    const headerEl = this.containerEl.createDiv("calendar-header");

    const prevMonthBtn = headerEl.createEl("button", { text: "←" });
    prevMonthBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.navigateMonth(-1);
    });

    const monthYearEl = headerEl.createEl("span", {
      text: this.getMonthName(this.currentMonth) + " " + this.currentYear,
    });
    monthYearEl.addClass("month-year-display");

    const nextMonthBtn = headerEl.createEl("button", { text: "→" });
    nextMonthBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.navigateMonth(1);
    });

    const daysHeader = this.containerEl.createDiv("calendar-days-header");
    const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    const firstDay = this.plugin.settings.firstDayOfWeek;
    for (let i = 0; i < 7; i++) {
      const dayIndex = (i + firstDay) % 7;
      daysHeader.createEl("div", { text: daysOfWeek[dayIndex] });
    }

    const daysGrid = this.containerEl.createDiv("calendar-days-grid");
    daysGrid.tabIndex = 0;
    daysGrid.focus();

    this.renderCalendarDays(daysGrid, firstDay);
    
    if (this.focusedDay === null) {
      this.focusedDay = this.selectedDate.getDate();
      this.focusedMonth = this.selectedDate.getMonth();
      this.focusedYear = this.selectedDate.getFullYear();
    }
    this.updateFocus();
  }

  renderCalendarDays(daysGrid: HTMLElement, firstDay: number) {
    const firstDayOfMonth = new Date(this.currentYear, this.currentMonth, 1);
    let startingDayOfWeek = firstDayOfMonth.getDay();
    startingDayOfWeek = (startingDayOfWeek - firstDay + 7) % 7;

    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

    const previousMonth = this.currentMonth === 0 ? 11 : this.currentMonth - 1;
    const previousYear = this.currentMonth === 0 ? this.currentYear - 1 : this.currentYear;
    const daysInPreviousMonth = new Date(previousYear, previousMonth + 1, 0).getDate();

    let dayOfNextMonth = 1;

    for (let i = 0; i < 42; i++) {
      const dayEl = daysGrid.createEl("div");

      if (i < startingDayOfWeek) {
        const prevMonthDay = daysInPreviousMonth - startingDayOfWeek + i + 1;
        dayEl.textContent = prevMonthDay.toString();
        dayEl.addClass("adjacent-month");

        dayEl.addEventListener("click", (e) => {
          e.stopPropagation();
          this.selectedDate = new Date(previousYear, previousMonth, prevMonthDay);
          this.close();
          this.onChoose(this.formatDate());
        });
      } else if (i < startingDayOfWeek + daysInMonth) {
        const currentDay = i - startingDayOfWeek + 1;
        dayEl.textContent = currentDay.toString();

        const today = new Date();
        if (today.getDate() === currentDay && today.getMonth() === this.currentMonth && today.getFullYear() === this.currentYear) {
          dayEl.addClass("today");
        }

        if (this.selectedDate && this.selectedDate.getDate() === currentDay && this.selectedDate.getMonth() === this.currentMonth && this.selectedDate.getFullYear() === this.currentYear) {
          dayEl.addClass("selected");
        }

        dayEl.addEventListener("click", (e) => {
          e.stopPropagation();
          this.selectedDate = new Date(this.currentYear, this.currentMonth, currentDay);
          this.close();
          this.onChoose(this.formatDate());
        });
      } else {
        dayEl.textContent = dayOfNextMonth.toString();
        dayEl.addClass("adjacent-month");

        const nextMonth = this.currentMonth === 11 ? 0 : this.currentMonth + 1;
        const nextYear = this.currentMonth === 11 ? this.currentYear + 1 : this.currentYear;

        dayEl.addEventListener("click", (e) => {
          e.stopPropagation();
          this.selectedDate = new Date(nextYear, nextMonth, dayOfNextMonth);
          this.close();
          this.onChoose(this.formatDate());
        });

        dayOfNextMonth++;
      }
    }
  }

  positionNearCoords(coords: { left?: number; top?: number; bottom?: number; right?: number; }) {
    if (!coords || (typeof coords.top !== "number" && typeof coords.bottom !== "number")) {
      console.log("Invalid coordinates:", coords);
      return;
    }

    this.containerEl.style.display = "block";

    const rect = this.containerEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let top = (coords.bottom || coords.top || 0) + 5;
    let left = coords.left || 0;

    if (top + rect.height > viewportHeight) {
      top = (coords.top || coords.bottom || 0) - rect.height - 5;
    }

    if (top < 5) {
      top = 5;
    }

    if (left + rect.width > viewportWidth) {
      left = Math.max(5, viewportWidth - rect.width - 5);
    }

    this.containerEl.style.transition = "none";
    this.containerEl.style.top = `${top}px`;
    this.containerEl.style.left = `${left}px`;

    this.containerEl.getBoundingClientRect();
    this.containerEl.style.transition = "opacity 0.15s ease-out";
  }

  open() {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    this.containerEl.style.display = "block";
    const rect = this.containerEl.getBoundingClientRect();

    this.containerEl.style.top = `${viewportHeight / 2 - rect.height / 2}px`;
    this.containerEl.style.left = `${viewportWidth / 2 - rect.width / 2}px`;
  }

  close() {
    this.containerEl.remove();
    document.removeEventListener("click", this.handleOutsideClick);
  }

  navigateMonth(change: number) {
    this.currentMonth += change;

    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }

    this.render();
  }

  getMonthName(month: number): string {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return months[month];
  }

  formatDate(): string {
    const format = this.plugin.settings.format;
    const year = this.selectedDate.getFullYear();
    const month = this.selectedDate.getMonth() + 1;
    const day = this.selectedDate.getDate();

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const dateString = format
      .replace("YYYY", year.toString())
      .replace("YY", (year % 100).toString().padStart(2, "0"))
      .replace("MMM", months[month - 1])
      .replace("MM", month.toString().padStart(2, "0"))
      .replace("M", month.toString())
      .replace("DD", day.toString().padStart(2, "0"))
      .replace("D", day.toString());

    if (!this.plugin.settings.useStyledDates) {
      return dateString;
    }

    const isoDate = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    return `<span class="styled-date" data-date="${isoDate}">${dateString}</span>`;
  }

  handleOutsideClick = (e: MouseEvent) => {
    if (!this.containerEl.contains(e.target as Node)) {
      this.close();
    }
  };
} 