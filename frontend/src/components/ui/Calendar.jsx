import React from 'react';
import { DayPicker } from 'react-day-picker';
import { vi } from 'date-fns/locale';
import './date-picker.scss';

export const Calendar = ({
  mode = 'range',
  selected,
  onSelect,
  locale = vi,
  className = '',
  numberOfMonths = 1,
  showOutsideDays = true,
  captionLayout = 'dropdown',
  startMonth = new Date(2020, 0),
  endMonth = new Date(2035, 11),
  ...props
}) => {
  return (
    <div className={`calendar-wrapper ${className}`}>
      <DayPicker
        mode={mode}
        selected={selected}
        onSelect={onSelect}
        locale={locale}
        showOutsideDays={showOutsideDays}
        numberOfMonths={numberOfMonths}
        captionLayout={captionLayout}
        startMonth={startMonth}
        endMonth={endMonth}
        modifiersClassNames={{
          range_start: 'range_start',
          range_end: 'range_end',
          range_middle: 'range_middle'
        }}
        {...props}
      />
    </div>
  );
};
