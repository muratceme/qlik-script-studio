import type { DatePart } from '@/model/types';
import type { Context } from '../context';
import { renderDatePart } from '../expr';
import { qName, qTable } from '../quote';
import { formatColumns, type ScriptWriter } from '../writer';

export const CALENDAR_FIELD_NAMES: Record<DatePart, string> = {
  year: 'Year',
  quarter: 'Quarter',
  month: 'Month',
  monthName: 'MonthName',
  week: 'Week',
  day: 'Day',
  weekday: 'WeekDay',
  yearMonth: 'YearMonth',
};

export function emitCalendar(ctx: Context, w: ScriptWriter): void {
  const calendar = ctx.project.calendar;
  if (!calendar || !calendar.enabled || !calendar.dateField) return;
  const tableName = ctx.tableName(calendar.dateField.tableId);
  const dateName = qName(ctx.outName(calendar.dateField));
  const range = `${calendar.tableName}_Range`;

  w.comment(`Master calendar for ${tableName}.${ctx.outName(calendar.dateField)}`);
  w.line(`${qTable(range)}:`);
  w.line('LOAD');
  w.lines(
    formatColumns([
      { expr: `Min(Floor(${dateName}))`, alias: 'MinDate' },
      { expr: `Max(Floor(${dateName}))`, alias: 'MaxDate' },
    ]),
  );
  w.line(`RESIDENT ${qTable(tableName)};`);
  w.blank();
  w.line(`LET vMinDate = Num(Peek('MinDate', 0, '${range}'));`);
  w.line(`LET vMaxDate = Num(Peek('MaxDate', 0, '${range}'));`);
  w.line(`DROP TABLE ${qTable(range)};`);
  w.blank();

  const columns: { expr: string; alias: string | null }[] = [{ expr: dateName, alias: null }];
  for (const part of calendar.parts) {
    columns.push({ expr: renderDatePart(part, dateName), alias: qName(CALENDAR_FIELD_NAMES[part]) });
  }
  w.line(`${qTable(calendar.tableName)}:`);
  w.line('LOAD');
  w.lines(formatColumns(columns));
  w.line(';');
  w.line('LOAD');
  w.lines(formatColumns([{ expr: 'Date($(vMinDate) + IterNo() - 1)', alias: dateName }]));
  w.line('AUTOGENERATE 1');
  w.line('WHILE $(vMinDate) + IterNo() - 1 <= $(vMaxDate);');
  w.blank();
  w.line('LET vMinDate = Null();');
  w.line('LET vMaxDate = Null();');
}
