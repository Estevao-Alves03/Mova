import { LoaderCircle, Search, UserRound } from "lucide-react"
import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { useNavigate } from "react-router"

import { Input } from "@/components/ui/input"
import { MIN_SEARCH_LENGTH, usePatientSearch, type PatientSearchResult } from "@/features/patients/api"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { cn } from "@/lib/utils"

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** Destaca o trecho digitado (sem diferenciar acentos nem maiúsculas). */
function Highlight({ text, term }: { text: string; term: string }) {
  const needle = fold(term.trim())
  const haystack = fold(text)
  // Só destaca quando a versão sem acentos tem o mesmo tamanho (mesma posição de cada letra).
  const start = needle && haystack.length === text.length ? haystack.indexOf(needle) : -1
  if (start < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-foreground">{text.slice(start, start + needle.length)}</mark>
      {text.slice(start + needle.length)}
    </>
  )
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()

/**
 * Busca principal do topo: nome, telefone ou e-mail. Resultados no escopo do papel (a API decide).
 * Combobox acessível: setas navegam, Enter abre, Esc fecha; ⌘K / Ctrl+K foca o campo.
 */
export function PatientSearch() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const [value, setValue] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const debounced = useDebouncedValue(value, 250)
  const trimmed = value.trim()
  const search = usePatientSearch(debounced)
  const results: PatientSearchResult[] = trimmed.length >= MIN_SEARCH_LENGTH ? (search.data ?? []) : []
  // A lista mostrada pode ser a da busca anterior enquanto a nova carrega.
  const waiting = trimmed.length >= MIN_SEARCH_LENGTH && (debounced.trim() !== trimmed || search.isFetching)
  const showAll = results.length > 0
  const optionCount = results.length + (showAll ? 1 : 0)

  // Atalho anunciado no campo (⌘K / Ctrl+K).
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  function close() {
    setOpen(false)
    setActive(-1)
  }

  function finish() {
    setValue("")
    close()
    inputRef.current?.blur()
  }

  // A tela do paciente ainda não existe: abre a lista já filtrada por ele.
  const goToList = (query: string) => {
    navigate(`/app/patients?q=${encodeURIComponent(query)}`)
    finish()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!optionCount) return
      event.preventDefault()
      setOpen(true)
      const step = event.key === "ArrowDown" ? 1 : -1
      setActive((current) => (current + step + optionCount) % optionCount)
    } else if (event.key === "Enter") {
      event.preventDefault()
      if (active >= 0 && active < results.length) goToList(results[active].full_name)
      else if (trimmed.length >= MIN_SEARCH_LENGTH) goToList(trimmed)
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault()
        close()
      } else {
        setValue("")
        inputRef.current?.blur()
      }
    }
  }

  const statusText =
    trimmed.length === 0
      ? ""
      : trimmed.length < MIN_SEARCH_LENGTH
        ? `Digite ao menos ${MIN_SEARCH_LENGTH} caracteres.`
        : waiting
          ? "Buscando…"
          : search.isError
            ? "Não foi possível buscar agora."
            : results.length === 0
              ? "Nenhum paciente encontrado."
              : `${results.length} ${results.length === 1 ? "resultado" : "resultados"}`

  const expanded = open && trimmed.length > 0

  return (
    <div
      ref={rootRef}
      role="search"
      className="relative flex min-w-0 flex-1 items-center md:w-full md:flex-none"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) close()
      }}
    >
      {waiting ? (
        <LoaderCircle className="pointer-events-none absolute left-3 size-[18px] animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <Search className="pointer-events-none absolute left-3 size-[18px] text-muted-foreground" aria-hidden />
      )}
      <Input
        ref={inputRef}
        type="text"
        name="patient-search"
        role="combobox"
        aria-label="Buscar paciente"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        placeholder="Buscar por nome, telefone ou e-mail..."
        autoComplete="off"
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-10 rounded-xl bg-muted pr-4 pl-10 text-sm shadow-none sm:pr-14"
      />
      <kbd className="pointer-events-none absolute right-3 hidden rounded border border-border bg-card px-1.5 py-0.5 font-data text-[11px] leading-[14px] text-muted-foreground shadow-xs sm:inline-block">
        ⌘K
      </kbd>

      {/* Anunciado por leitores de tela: quantidade de resultados e estados. */}
      <span role="status" className="sr-only">
        {expanded ? statusText : ""}
      </span>

      {expanded && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg md:min-w-[26rem]">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground" aria-hidden>
              {statusText}
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Pacientes encontrados" className="max-h-80 overflow-y-auto py-1">
              {results.map((patient, index) => (
                <li
                  key={patient.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={active === index}
                  // mousedown antes do blur: o campo mantém o foco até o clique ser tratado.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => goToList(patient.full_name)}
                  onMouseMove={() => setActive(index)}
                  className={cn("flex cursor-pointer items-center gap-3 px-3 py-2", active === index && "bg-accent")}
                >
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground"
                  >
                    {initials(patient.full_name) || <UserRound className="size-4" />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm leading-5 font-semibold">
                      <Highlight text={patient.full_name} term={value} />
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 truncate font-data text-xs text-muted-foreground">
                      {[patient.phone, patient.email].filter(Boolean).map((part, position) => (
                        <Fragment key={position}>
                          {position > 0 && <span aria-hidden>•</span>}
                          <span className="truncate">
                            <Highlight text={part as string} term={value} />
                          </span>
                        </Fragment>
                      ))}
                      {!patient.phone && !patient.email && "Sem contato cadastrado"}
                    </span>
                  </span>
                </li>
              ))}
              <li
                id={`${listId}-${results.length}`}
                role="option"
                aria-selected={active === results.length}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => goToList(trimmed)}
                onMouseMove={() => setActive(results.length)}
                className={cn(
                  "cursor-pointer border-t border-border/70 px-4 py-2.5 text-[13px] font-medium text-primary",
                  active === results.length && "bg-accent",
                )}
              >
                Ver todos os resultados para “{trimmed}”
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
