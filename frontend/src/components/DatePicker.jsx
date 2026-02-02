import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const DatePicker = ({ selectedDate, onDateSelect, placeholder = "Select date" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [viewMode, setViewMode] = useState('day'); // 'day', 'month', 'year'
    const datePickerRef = useRef(null);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days = [];

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(day);
        }

        return days;
    };

    const handleDateClick = (day) => {
        if (day) {
            const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const date = String(selectedDate.getDate()).padStart(2, '0');
            onDateSelect(`${year}-${month}-${date}`);
            setIsOpen(false);
        }
    };

    const handlePrevMonth = () => {
        if (viewMode === 'day') {
            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
        } else if (viewMode === 'month') {
            setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1));
        } else if (viewMode === 'year') {
            setCurrentMonth(new Date(currentMonth.getFullYear() - 10, currentMonth.getMonth(), 1));
        }
    };

    const handleNextMonth = () => {
        if (viewMode === 'day') {
            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
        } else if (viewMode === 'month') {
            setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth(), 1));
        } else if (viewMode === 'year') {
            setCurrentMonth(new Date(currentMonth.getFullYear() + 10, currentMonth.getMonth(), 1));
        }
    };

    const handleMonthHeaderClick = () => {
        if (viewMode === 'day') {
            setViewMode('month');
        } else if (viewMode === 'month') {
            setViewMode('year');
        } else if (viewMode === 'year') {
            setViewMode('day');
        }
    };

    const handleMonthClick = (monthIndex) => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), monthIndex, 1));
        setViewMode('day');
    };

    const handleYearClick = (year) => {
        setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
        setViewMode('month');
    };

    const formatDisplayDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatDateForComparison = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const days = getDaysInMonth(currentMonth);

    // Handle click outside to close the date picker
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={datePickerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#C4009A] bg-white flex items-center justify-between min-w-[140px]"
            >
                <span className={selectedDate ? 'text-slate-900' : 'text-slate-500'}>
                    {selectedDate ? formatDisplayDate(selectedDate) : placeholder}
                </span>
                <Calendar size={16} className="text-slate-400" />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 min-w-[280px]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={handlePrevMonth}
                            className="p-1 hover:bg-slate-100 rounded"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={handleMonthHeaderClick}
                            className="font-semibold text-slate-800 hover:bg-slate-100 px-2 py-1 rounded transition-colors"
                        >
                            {viewMode === 'day' && `${months[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`}
                            {viewMode === 'month' && `${currentMonth.getFullYear()}`}
                            {viewMode === 'year' && `${Math.floor(currentMonth.getFullYear() / 10) * 10} - ${Math.floor(currentMonth.getFullYear() / 10) * 10 + 9}`}
                        </button>
                        <button
                            onClick={handleNextMonth}
                            className="p-1 hover:bg-slate-100 rounded"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Conditional content based on view mode */}
                    {viewMode === 'day' && (
                        <>
                            {/* Days of week header */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {daysOfWeek.map(day => (
                                    <div key={day} className="text-center text-xs font-medium text-slate-500 py-1">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar grid */}
                            <div className="grid grid-cols-7 gap-1">
                                {days.map((day, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleDateClick(day)}
                                        disabled={!day}
                                        className={`
                                            h-8 w-8 text-sm rounded disabled:hover:bg-transparent
                                            ${day ? 'text-slate-700' : 'text-transparent'}
                                            ${selectedDate === formatDateForComparison(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
                                                ? 'bg-[#C4009A] text-white hover:bg-[#7E006C]'
                                                : 'hover:bg-slate-100'
                                            }
                                        `}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {viewMode === 'month' && (
                        <div className="grid grid-cols-3 gap-2">
                            {months.map((month, index) => (
                                <button
                                    key={month}
                                    onClick={() => handleMonthClick(index)}
                                    className={`
                                        h-10 text-sm rounded hover:bg-slate-100 transition-colors
                                        ${currentMonth.getMonth() === index && currentMonth.getFullYear() === new Date().getFullYear()
                                            ? 'bg-[#C4009A] text-white hover:bg-[#7E006C]'
                                            : 'text-slate-700 hover:bg-slate-100'
                                        }
                                    `}
                                >
                                    {month.slice(0, 3)}
                                </button>
                            ))}
                        </div>
                    )}

                    {viewMode === 'year' && (
                        <div className="grid grid-cols-3 gap-2">
                            {Array.from({ length: 10 }, (_, i) => {
                                const year = Math.floor(currentMonth.getFullYear() / 10) * 10 + i;
                                return (
                                    <button
                                        key={year}
                                        onClick={() => handleYearClick(year)}
                                        className={`
                                            h-10 text-sm rounded hover:bg-slate-100 transition-colors
                                            ${currentMonth.getFullYear() === year
                                                ? 'bg-[#C4009A] text-white hover:bg-[#7E006C]'
                                                : 'text-slate-700 hover:bg-slate-100'
                                            }
                                        `}
                                    >
                                        {year}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Clear button */}
                    <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between">
                        <button
                            onClick={() => {
                                onDateSelect(null);
                                setIsOpen(false);
                            }}
                            className="text-sm text-slate-600 hover:text-slate-800"
                        >
                            Clear
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-sm text-[#C4009A] hover:text-[#7E006C]"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DatePicker;
