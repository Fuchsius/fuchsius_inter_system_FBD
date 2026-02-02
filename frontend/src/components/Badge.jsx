const Badge = ({ children, color = "default" }) => {
  const styles = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    error: "bg-rose-50 text-rose-700",
    brand: "bg-fuchsia-50 text-[#7E006C]",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[color]}`}>
      {children}
    </span>
  );
};

export default Badge;
