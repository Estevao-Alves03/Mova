export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="px-1 text-xs leading-4 text-destructive">
      {message}
    </p>
  )
}
