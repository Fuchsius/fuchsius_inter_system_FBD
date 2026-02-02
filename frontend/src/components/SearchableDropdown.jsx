import React, { useState, useRef, useEffect } from 'react';

const SearchableDropdown = ({
  options = [],
  value,
  onChange,
  placeholder = "Search...",
  displayKey = "name",
  valueKey = "id",
  allOptionLabel = "All",
  showAllOption = true,
  className = "",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Get display text for selected value
  const getDisplayText = () => {
    if (!value || value === 'all') {
      return allOptionLabel;
    }
    const selected = options.find(opt => opt[valueKey] === value);
    return selected ? selected[displayKey] : '';
  };

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option[displayKey]?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle selection
  const handleSelect = (selectedValue) => {
    onChange(selectedValue);
    setSearchTerm('');
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
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
    <div ref={dropdownRef} className={`relative ${className}`}>
      <input
        type="text"
        value={isOpen ? searchTerm : getDisplayText()}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => !disabled && setIsOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#C4009A] disabled:bg-slate-100 disabled:cursor-not-allowed"
      />
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {showAllOption && (
            <div
              className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
              onMouseDown={() => handleSelect('all')}
            >
              {allOptionLabel}
            </div>
          )}
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option[valueKey]}
                className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                onMouseDown={() => handleSelect(option[valueKey])}
              >
                {option[displayKey]}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-400">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;
