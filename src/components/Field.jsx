// Guidage contextuel obligatoire : label, champ (children), texte d'aide sous le champ.
export default function Field({ id, label, help, children }) {
  return (
    <div className="plai-field">
      <label className="plai-label" htmlFor={id}>{label}</label>
      {children}
      {help && <p className="hub-help" id={`${id}-help`}>{help}</p>}
    </div>
  )
}
