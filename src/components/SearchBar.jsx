export default function SearchBar({ value, onChange }) {
  return (
    <input
      type="text"
      placeholder="Buscar por título, autor, género..."
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="search"
    />
  );
}
