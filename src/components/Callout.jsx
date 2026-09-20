// Encadré explicatif : répond à une question avant qu'elle ne soit posée. Jamais imprimé.
export default function Callout({ title, children, className = '' }) {
  return (
    <div className={`hub-callout hub-noprint ${className}`} role="note">
      {title && <p className="hub-callout-title">{title}</p>}
      {children}
    </div>
  )
}
