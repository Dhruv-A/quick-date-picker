export interface DatePickerSettings {
  format: string;
  firstDayOfWeek: number;
  includeTime: boolean;
  timeFormat: string;
  useStyledDates: boolean;
}

export const DEFAULT_SETTINGS: DatePickerSettings = {
  format: "YYYY-MM-DD",
  firstDayOfWeek: 1,
  includeTime: false,
  timeFormat: "HH:mm",
  useStyledDates: true,
};

export interface DateRange {
  from: { line: number; ch: number };
  to: { line: number; ch: number };
  text: string;
} 