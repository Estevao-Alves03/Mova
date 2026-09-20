# Design System — Pacto Estoque Pro / Estokia

Documento de referência para replicar fielmente a identidade visual, padrões de UI, tipografia, cores, efeitos, animações e responsividade deste produto em outros projetos.

Stack-alvo: **React + TanStack Start + Tailwind CSS v4 + shadcn/ui (style: new-york) + Radix UI + lucide-react**.

As telas exportadas do Stitch estão em:

`docs/design/telas/`

O ZIP é uma referência visual aprovada e deve ser tratado como somente leitura.

Quando houver conflito entre uma especificação antiga e as telas aprovadas,
as decisões registradas neste documento prevalecem.

---

## 1. Filosofia de Design

- **Tom:** SaaS profissional, denso em informação, mas com respiro. Apple-like minimal, com toques de modernidade tech (gradiente azul-índigo da marca).
- **Modo padrão:** Light. Dark mode totalmente suportado via `.dark` na raiz.
- **Princípios:**
  - Hierarquia clara por peso/tamanho tipográfico, não por excesso de cor.
  - Bordas suaves (`rounded-md`/`rounded-xl`), sombras sutis (`shadow-sm`/`shadow`).
  - Acento único (`primary` azul `#026DFC`) usado com parcimônia para CTAs e estados ativos.
  - Microinterações curtas (150–300ms), nunca decorativas.
  - Densidade alta em tabelas/dashboards, generosa em formulários.

---

## 2. Tipografia

### 2.1 Famílias

| Token            | Família           | Uso                                   |
| ---------------- | ----------------- | ------------------------------------- |
| `--font-sans`    | **Mona Sans**     | Corpo, UI geral                       |
| `--font-display` | **Mona Sans** 700 | Títulos H1–H6                         |
| `--font-mono`    | **Geist Mono**    | Código, IDs, números tabulares        |

Carregadas via Google Fonts (pesos 200–900, itálico incluso):

```html
<link href="https://fonts.googleapis.com/css2?family=Mona+Sans:ital,wght@0,200..900;1,200..900&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### 2.2 Escala (Tailwind padrão)

| Classe       | Tamanho    | Uso recomendado                |
| ------------ | ---------- | ------------------------------ |
| `text-xs`    | 12px / 16  | Legendas, badges               |
| `text-sm`    | 14px / 20  | Corpo padrão UI                |
| `text-base`  | 16px / 24  | Inputs em mobile, parágrafos   |
| `text-lg`    | 18px / 28  | Subtítulos de card             |
| `text-xl`    | 20px / 28  | Títulos de seção               |
| `text-2xl`   | 24px / 32  | H2 de página                   |
| `text-3xl`   | 30px / 36  | H1 de página                   |
| `text-4xl+`  | 36px+      | Hero / dashboards              |

### 2.3 Pesos

- `font-normal` (400) corpo
- `font-medium` (500) labels, botões
- `font-semibold` (600) títulos de card, valores destacados
- `font-bold` (700) headings, badges

### 2.4 Antialiasing

```css
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

---

## 3. Sistema de Cores (Design Tokens)

Tokens definidos em `src/styles.css` com `oklch()` e expostos via `@theme inline`. **Nunca usar cores hard-coded** (ex: `bg-white`, `text-black`) em componentes — sempre tokens semânticos.

### 3.1 Light (raiz `:root`)

| Token                       | Valor `oklch`             | Hex aprox. | Função                          |
| --------------------------- | ------------------------- | ---------- | ------------------------------- |
| `--background`              | `oklch(1 0 0)`            | `#FFFFFF`  | Fundo da app                    |
| `--foreground`              | `oklch(0.22 0 0)`         | `#333232`  | Texto principal                 |
| `--card` / `--popover`      | `oklch(1 0 0)`            | `#FFFFFF`  | Superfícies elevadas            |
| `--primary`                 | `oklch(0.53 0.22 250)`    | `#026DFC`  | Marca / CTA                     |
| `--primary-foreground`      | `oklch(0.985 0 0)`        | `#FAFAFA`  | Texto sobre primary             |
| `--secondary` / `--muted`   | `oklch(0.965 0 0)`        | `#F2F2F2`  | Fundos sutis                    |
| `--muted-foreground`        | `oklch(0.5 0 0)`          | `#808080`  | Texto auxiliar                  |
| `--accent`                  | `oklch(0.96 0.02 250)`    | `#EEF3FE`  | Hover/seleção                   |
| `--accent-foreground`       | `oklch(0.53 0.22 250)`    | `#026DFC`  | Texto sobre accent              |
| `--destructive`             | `oklch(0.637 0.237 25.3)` | `#EF4444`  | Erros, exclusão                 |
| `--success`                 | `oklch(0.65 0.18 145.96)` | `#22C55E`  | Sucesso                         |
| `--warning`                 | `oklch(0.769 0.188 70)`   | `#F59E0B`  | Atenção                         |
| `--border` / `--input`      | `oklch(0.92 0 0)`         | `#EAEAEA`  | Bordas                          |
| `--ring`                    | `oklch(0.53 0.22 250)`    | `#026DFC`  | Foco                            |

### 3.2 Dark (`.dark`)

Mesmos slots semânticos, com fundo `oklch(0.145 0 0)` (≈ `#0A0A0A`) e foreground `oklch(0.961 0 0)`. Primary ligeiramente mais clara (`oklch(0.62 0.20 250)`) para preservar contraste sobre fundo escuro.

### 3.3 Sidebar (token dedicado)

Tokens `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring`. No tema "Pacto" a sidebar recebe um **gradiente fixo**:

```css
.sidebar-pacto [data-sidebar="sidebar"] {
  background: linear-gradient(179.28deg, #015cc4 .05%, #1d16ab 53.55%, #000b38 99.95%) !important;
  color: white !important;
}
```

Estados (hover, active, ícones, labels) usam `rgba(255,255,255, 0.05–0.15)` para preservar legibilidade sobre o gradiente.

---

## 4. Radius, Shadows e Elevação

### 4.1 Border radius

```css
--radius: 0.75rem; /* 12px base */
--radius-sm: calc(var(--radius) - 4px);  /* 8px  */
--radius-md: calc(var(--radius) - 2px);  /* 10px */
--radius-lg: var(--radius);              /* 12px */
--radius-xl: calc(var(--radius) + 4px);  /* 16px */
```

Convenção de uso:
- `rounded-md` (10px) → botões, inputs altos, badges grandes
- `rounded-lg` (12px) → cards menores, dropdowns
- `rounded-xl` (16px) → cards de página, inputs principais, dialogs
- `rounded-full` → avatars, badges circulares, pílulas de status

### 4.2 Sombras (Tailwind defaults v4)

- `shadow-xs` → inputs em repouso
- `shadow-sm` → botões secondary/outline
- `shadow` → botões primary, cards interativos
- `shadow-md`/`shadow-lg` → popovers, dropdowns
- `shadow-xl` → tooltips e modais

---

## 5. Componentes-Chave (padrões shadcn/ui)

Todos seguem `components.json`: style `new-york`, base color `slate`, `cssVariables: true`, icon library `lucide-react`. Aliases: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`.

### 5.1 Button (`src/components/ui/button.tsx`)

Variantes: `default | destructive | outline | secondary | ghost | link`.
Tamanhos: `default (h-9 px-4)`, `sm (h-8 px-3 text-xs)`, `lg (h-10 px-8)`, `icon (h-9 w-9)`.

Base:
```
inline-flex items-center justify-center gap-2 whitespace-nowrap
rounded-md text-sm font-medium transition-colors
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed
[&_svg]:size-4 [&_svg]:shrink-0
```

### 5.2 Input (`src/components/ui/input.tsx`)

```
flex h-10 w-full rounded-xl border border-input bg-background/50
px-3 py-1 text-base md:text-sm shadow-sm
transition-all
focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

Detalhe: fundo translúcido `bg-background/50` para harmonizar com cards.

### 5.3 Card

```
rounded-xl border border-border/50 bg-card text-card-foreground
```
- `CardHeader` → `flex flex-col space-y-1.5 p-6`
- `CardContent` → `p-6 pt-0`
- `CardTitle` → `font-semibold leading-none tracking-tight`

### 5.4 Badge

Pílulas pequenas em caixa-alta, com microinteração de escala:
```
inline-flex items-center rounded-lg border px-2.5 py-0.5
text-[10px] font-bold uppercase tracking-wider
transition-all duration-200
hover:scale-[1.03] active:scale-[0.98]
```

### 5.5 Tooltip

Container `delayDuration={150}`. Conteúdo:
```
z-50 rounded-lg bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-xl
animate-in fade-in-0 zoom-in-95
data-[side=top]:slide-in-from-bottom-2 ...
```

### 5.6 Dialog, Sheet, Drawer, Popover, DropdownMenu

Todos via Radix com tokens `popover`/`popover-foreground`, sombras `shadow-lg`/`shadow-xl` e animações `animate-in/animate-out` do `tw-animate-css`.

### 5.7 Sidebar (`src/components/ui/sidebar.tsx`)

Suporta variante "Pacto" (gradiente azul). Usa atributos `data-sidebar="*"` para targets CSS de tema. Foco visível e estados hover/active definidos via `data-active="true"`.

### 5.8 Indicador de campo obrigatório (automático)

Definido em `@layer components`. Qualquer `<label>` que precede um `[required]` ou `[aria-required="true"]` recebe um `*` vermelho via pseudo-elemento:

```css
label:has(+ input[required])::after { content: " *"; color: var(--color-destructive); font-weight: 700; }
```

Componente opcional `FormLegend` exibe legenda discreta no topo do form.

---

## 6. Animações

### 6.1 Keyframes nativos (Tailwind + custom)

- `accordion-down` / `accordion-up` — 200ms ease-out
- `fade-in` / `fade-out` — 300ms ease-out, com `translateY(10px)`
- `scale-in` / `scale-out` — 200ms ease-out, escala 0.95→1
- `slide-in-right` / `slide-out-right` — 300ms ease-out
- Combinados: `enter` (fade+scale) e `exit`

### 6.2 Animações utilitárias (via `tw-animate-css`)

`animate-in`, `animate-out`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*-2`, `data-[state=open]:*`, `data-[motion=*]:*` — usadas em todos os overlays Radix.

### 6.3 Indeterminate progress (custom)

```css
@keyframes progress-indeterminate {
  0%   { transform: translateX(-100%) scaleX(0.2); }
  50%  { transform: translateX(0%)    scaleX(0.5); }
  100% { transform: translateX(100%)  scaleX(0.2); }
}
.animate-progress-indeterminate { animation: progress-indeterminate 1.5s infinite linear; transform-origin: left; }
```

### 6.4 Padrões de microinteração

- Hover de elementos clicáveis: `hover-scale` (`transition-transform duration-200 hover:scale-105`)
- Links em texto: classe `.story-link` (sublinhado animado da esquerda para a direita)
- Badges: escala 1.03 no hover / 0.98 no active
- Transições padrão: **150–300ms `ease-out`**. Nunca passar de 400ms para UI funcional.

---

## 7. Iconografia

- Biblioteca: **lucide-react**.
- Tamanho padrão dentro de botões/inputs: `size-4` (16px) — forçado via `[&_svg]:size-4 [&_svg]:shrink-0`.
- Em headings e cards: `size-5` (20px) ou `size-6` (24px).
- Stroke padrão da Lucide (`stroke-width=2`) preservado.

---

## 8. Responsividade

Breakpoints Tailwind v4 padrão:

| Prefix  | min-width |
| ------- | --------- |
| `sm:`   | 640px     |
| `md:`   | 768px     |
| `lg:`   | 1024px    |
| `xl:`   | 1280px    |
| `2xl:`  | 1536px    |

Convenções:
- **Mobile-first sempre**: classes base servem mobile; usar prefixos para escalar.
- Inputs: `text-base` no mobile (evita zoom iOS), `md:text-sm` no desktop.
- Containers de página: `container mx-auto px-4 md:px-6 lg:px-8`.
- Grids de cards: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6`.
- Sidebar colapsa em mobile via componente Sheet.
- Tabelas densas: wrapper `overflow-x-auto` com `min-w-full`; em mobile preferir lista de cards.
- Tipografia responsiva: `text-2xl md:text-3xl lg:text-4xl` para H1.
- Toque: alvo mínimo 40×40px (`h-10`).

---

## 9. Espaçamento e Layout

- Escala Tailwind padrão (4px-base). Preferir `gap-*` a `space-*`.
- **Padding interno de card:** `p-6` (24px). Em mobile pode cair para `p-4`.
- **Gutter de grids:** `gap-4` mobile, `gap-6` desktop.
- **Vertical rhythm:** `space-y-1.5` em headers de card, `space-y-4` em formulários, `space-y-6` entre seções.
- Página típica: `max-w-7xl mx-auto py-6 md:py-10 space-y-6`.

---

## 10. Backgrounds e Superfícies

- **Fundo da app:** `bg-background` (puro `#FFF` / `#0A0A0A` no dark).
- **Cards:** `bg-card` com `border border-border/50`.
- **Inputs:** `bg-background/50` (translúcido) para harmonizar dentro de cards.
- **Sidebar "Pacto":** gradiente diagonal azul → índigo → quase-preto (ver §3.3).
- **Overlays de dialog:** `bg-black/80` com `backdrop-blur-sm`.
- **Gradientes utilitários** (definir conforme produto):
  ```css
  --gradient-primary: linear-gradient(135deg, var(--primary), oklch(0.62 0.22 270));
  --shadow-elegant:   0 10px 30px -10px color-mix(in oklab, var(--primary) 30%, transparent);
  ```

---

## 11. Acessibilidade

- Foco visível obrigatório: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` em todo elemento interativo.
- Contraste mínimo AA garantido pelos tokens light/dark.
- `prefers-reduced-motion`: respeitar — desativar `hover-scale` e durações > 200ms quando ativo.
- Labels obrigatórias em todo input (mesmo via `sr-only`).
- Estados de erro: `text-destructive` + `aria-invalid="true"` + texto auxiliar.

---

## 12. Tailwind v4 — Setup Mínimo

`src/styles.css`:

```css
@import url("https://fonts.googleapis.com/css2?family=Mona+Sans:ital,wght@0,200..900;1,200..900&family=Geist+Mono:wght@400;500;600&display=swap");
@import "tailwindcss" source(none);
@import "tw-animate-css";
@source "../src";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: "Mona Sans", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Mona Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, monospace;

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ... mapear todos os tokens semânticos ... */
}

:root { /* tokens light — ver §3.1 */ }
.dark { /* tokens dark  — ver §3.2 */ }
```

`components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "tailwind": { "css": "src/styles.css", "baseColor": "slate", "cssVariables": true },
  "iconLibrary": "lucide",
  "aliases": { "components": "@/components", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks", "utils": "@/lib/utils" }
}
```

Helper `cn`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

Dependências essenciais:
```
react react-dom @radix-ui/react-* class-variance-authority clsx tailwind-merge
tailwindcss @tailwindcss/vite tw-animate-css lucide-react
```

---

## 13. Regras de Ouro para Replicar

1. **Sempre usar tokens semânticos** (`bg-primary`, `text-muted-foreground`) — nunca `bg-blue-500` ou `text-white`.
2. **Nunca hard-code de fontes** — usar `font-sans`, `font-display`, `font-mono`.
3. **Radius:** padronizar em `rounded-md` (controles) / `rounded-xl` (cards e inputs principais).
4. **Animações curtas e funcionais** — fade+scale entre 150–300ms.
5. **Foco visível obrigatório** em todo elemento interativo.
6. **Mobile-first**, com `text-base` em inputs mobile.
7. **Dark mode desde o dia 1** — todo token novo definido em `:root` e `.dark`.
8. **Iconografia única:** lucide-react, `size-4` em contexto de controle.
9. **Sidebar com gradiente** opcional via classe `.sidebar-pacto` no wrapper.
10. **Indicador `*` automático** de campos obrigatórios via CSS — não duplicar no JSX.

---

_Versão 1.0 — extraído fielmente de `src/styles.css`, `components.json` e dos componentes em `src/components/ui/`._