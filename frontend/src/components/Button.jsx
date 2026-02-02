import React from 'react';

const THEME = {
  gradient: "bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
  primaryBtn: "bg-gradient-to-r from-[#7E006C] to-[#C4009A] text-white hover:opacity-90 shadow-md hover:shadow-lg transition-all",
};

const Button = ({ children, variant = "primary", className = "", icon: Icon, onClick, disabled }) => {
  const base = "px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: THEME.primaryBtn,
    outline: "border border-slate-200 text-slate-700 bg-white hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
};

export default Button;
