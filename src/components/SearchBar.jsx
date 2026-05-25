export default function SearchBar({ value, onChange }) {
  return (
    <input
      type="text"
      placeholder="Buscar por título, autor, género..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="search"
    />
  );
}
