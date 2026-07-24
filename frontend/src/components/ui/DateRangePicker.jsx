import React, { useState, useEffect } from 'react';
import { Calendar } from './Calendar';
import { Popover } from './Popover';
import { FiCalendar } from 'react-icons/fi';
import { vi } from 'date-fns/locale';
import './date-picker.scss';

/**
 * Civil Date helper: parse yyyy-mm-dd string to local Date object (noon local time)
 * Avoids ISO UTC parsing off-by-one errors.
 */
export function parseCivilDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return undefined;
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return undefined;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return undefined;
  return new Date(year, month, day, 12, 0, 0);
}

/**
 * Civil Date helper: format local Date object to yyyy-mm-dd string
 */
export function formatCivilDate(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Display helper: format yyyy-mm-dd to dd/mm/yyyy
 */
export function formatCivilDateDisplay(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Single DatePicker Component using Popover + Calendar
 * Allows choosing any date smoothly with range highlight support.
 */
export const SingleDatePicker = ({
  value,
  onChange,
  rangeStart,
  rangeEnd,
  locale = vi,
  placeholder = 'Chọn ngày',
  align = 'start',
  className = ''
}) => {
  const currentDate = parseCivilDate(value);
  const startDateObj = parseCivilDate(rangeStart);
  const endDateObj = parseCivilDate(rangeEnd);

  const [month, setMonth] = useState(() => currentDate || new Date());

  useEffect(() => {
    if (currentDate) {
      setMonth(currentDate);
    }
  }, [value]);

  const customModifiers = {};
  if (startDateObj) customModifiers.range_start = startDateObj;
  if (endDateObj) customModifiers.range_end = endDateObj;
  if (startDateObj && endDateObj && startDateObj < endDateObj) {
    customModifiers.range_middle = (date) => {
      const dTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime();
      const sTime = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate(), 12).getTime();
      const eTime = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate(), 12).getTime();
      return dTime > sTime && dTime < eTime;
    };
  }

  return (
    <Popover
      align={align}
      className={className}
      trigger={({ isOpen }) => (
        <div className={`date-picker-trigger-box ${isOpen ? 'is-open' : ''}`}>
          <span className={value ? 'date-value' : 'date-placeholder'}>
            {formatCivilDateDisplay(value) || placeholder}
          </span>
          <span className="calendar-icon">
            <FiCalendar size={16} />
          </span>
        </div>
      )}
    >
      {({ close }) => (
        <div>
          <Calendar
            mode="single"
            selected={currentDate}
            month={month}
            onMonthChange={setMonth}
            onSelect={(selectedDate) => {
              if (selectedDate) {
                const dateStr = formatCivilDate(selectedDate);
                if (onChange) onChange(dateStr);
                close();
              }
            }}
            modifiers={customModifiers}
            modifiersClassNames={{
              range_start: 'range_start',
              range_end: 'range_end',
              range_middle: 'range_middle'
            }}
            locale={locale}
          />
        </div>
      )}
    </Popover>
  );
};

/**
 * DateRangePicker Component using Popover + Calendar (mode="range")
 */
export const DateRangePicker = ({
  startDate,
  endDate,
  onChange,
  locale = vi,
  placeholder = 'Chọn khoảng thời gian',
  align = 'start',
  className = ''
}) => {
  const fromDate = parseCivilDate(startDate);
  const toDate = parseCivilDate(endDate);

  const selectedRange = {
    from: fromDate,
    to: toDate
  };

  const handleSelectRange = (range) => {
    const newStart = range?.from ? formatCivilDate(range.from) : '';
    const newEnd = range?.to ? formatCivilDate(range.to) : '';
    if (onChange) {
      onChange({ startDate: newStart, endDate: newEnd });
    }
  };

  const getDisplayText = () => {
    if (startDate && endDate) {
      return `${formatCivilDateDisplay(startDate)} — ${formatCivilDateDisplay(endDate)}`;
    }
    if (startDate) {
      return `${formatCivilDateDisplay(startDate)} — chọn ngày kết thúc`;
    }
    return placeholder;
  };

  return (
    <Popover
      align={align}
      className={className}
      trigger={({ isOpen }) => (
        <div className={`date-picker-trigger-box ${isOpen ? 'is-open' : ''}`}>
          <span className={startDate || endDate ? 'date-value' : 'date-placeholder'}>
            {getDisplayText()}
          </span>
          <span className="calendar-icon">
            <FiCalendar size={16} />
          </span>
        </div>
      )}
    >
      {() => (
        <div>
          <Calendar
            mode="range"
            selected={selectedRange}
            onSelect={handleSelectRange}
            locale={locale}
          />
          <div className="calendar-preset-bar">
            <button
              type="button"
              className="preset-btn"
              onClick={() => {
                const today = new Date();
                const nextYear = new Date();
                nextYear.setFullYear(today.getFullYear() + 1);
                handleSelectRange({
                  from: today,
                  to: nextYear
                });
              }}
            >
              1 năm
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={() => {
                const today = new Date();
                const next6Months = new Date();
                next6Months.setMonth(today.getMonth() + 6);
                handleSelectRange({
                  from: today,
                  to: next6Months
                });
              }}
            >
              6 tháng
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={() => {
                handleSelectRange({ from: undefined, to: undefined });
              }}
            >
              Xóa
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
};
