import { App, PluginSettingTab, Setting } from "obsidian";
import DatePickerPlugin from "../main";

export class DatePickerSettingTab extends PluginSettingTab {
  plugin: DatePickerPlugin;

  constructor(app: App, plugin: DatePickerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Date Picker Settings" });

    new Setting(containerEl)
      .setName("Date format")
      .setDesc("Format for inserted dates (uses simplified moment.js format)")
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.plugin.settings.format)
          .onChange(async (value) => {
            this.plugin.settings.format = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("First day of week")
      .setDesc("Which day should be displayed as the first day of the week")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("0", "Sunday")
          .addOption("1", "Monday")
          .addOption("2", "Tuesday")
          .addOption("3", "Wednesday")
          .addOption("4", "Thursday")
          .addOption("5", "Friday")
          .addOption("6", "Saturday")
          .setValue(this.plugin.settings.firstDayOfWeek.toString())
          .onChange(async (value) => {
            this.plugin.settings.firstDayOfWeek = parseInt(value);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Include time")
      .setDesc("Whether to include a time picker")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeTime)
          .onChange(async (value) => {
            this.plugin.settings.includeTime = value;
            await this.plugin.saveSettings();
            timeFormatSetting.settingEl.style.display = value ? "flex" : "none";
          })
      );

    const timeFormatSetting = new Setting(containerEl)
      .setName("Time format")
      .setDesc("Format for inserted times (uses simplified moment.js format)")
      .addText((text) =>
        text
          .setPlaceholder("HH:mm")
          .setValue(this.plugin.settings.timeFormat)
          .onChange(async (value) => {
            this.plugin.settings.timeFormat = value;
            await this.plugin.saveSettings();
          })
      );

    timeFormatSetting.settingEl.style.display = this.plugin.settings.includeTime ? "flex" : "none";

    containerEl.createEl("h3", { text: "Date Styling" });

    new Setting(containerEl)
      .setName("Use styled dates")
      .setDesc("Apply visual styling to dates based on proximity to today")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useStyledDates)
          .onChange(async (value) => {
            this.plugin.settings.useStyledDates = value;
            await this.plugin.saveSettings();
          })
      );
  }
} 