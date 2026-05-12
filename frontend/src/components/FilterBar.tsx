import type { FilterCriterion, FilterField, FilterMode, FilterOperator, Task, TaskStatus, UrgencyLevel } from '../types';
import { STATES, STATE_BG, STATE_COLORS, URGENCY, TASK_KINDS, TASK_KIND_LABELS, URGENCY_LEVELS } from '../types';
import { useState, useEffect } from 'react';
import ReactSelect from 'react-select';
import type { StylesConfig } from 'react-select';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { evaluatePQL } from '../lib/pql';

const FIELD_LABELS: Record<FilterField, string> = {
  name: 'Nombre',
  body: 'Descripción',
  status: 'Estado',
  kind: 'Tipo',
  createdAt: 'Fecha de creación',
  dueOrNextDate: 'Fecha límite / Siguiente',
  urgency: 'Urgencia',
  labels: 'Labels',
  comments: 'Comentarios',
};

const FIELDS: FilterField[] = [
  'name', 'body', 'status', 'kind', 'createdAt', 'dueOrNextDate', 'urgency', 'labels', 'comments',
];

type OpDef = { value: FilterOperator; label: string };

const OPERATORS_BY_FIELD: Record<FilterField, OpDef[]> = {
  name: [
    { value: 'contains', label: 'contiene' },
    { value: 'not_contains', label: 'no contiene' },
    { value: 'exact', label: 'es exactamente' },
  ],
  body: [
    { value: 'contains', label: 'contiene' },
    { value: 'not_contains', label: 'no contiene' },
    { value: 'exact', label: 'es exactamente' },
  ],
  status: [
    { value: 'is_any_of', label: 'es alguno de' },
    { value: 'is_none_of', label: 'no es ninguno de' },
    { value: 'is', label: 'es' },
    { value: 'is_not', label: 'no es' },
  ],
  kind: [
    { value: 'is', label: 'es' },
    { value: 'is_not', label: 'no es' },
  ],
  createdAt: [
    { value: 'after', label: 'es después de' },
    { value: 'before', label: 'es antes de' },
    { value: 'on', label: 'es exactamente' },
  ],
  dueOrNextDate: [
    { value: 'before', label: 'es antes de' },
    { value: 'on', label: 'es exactamente' },
    { value: 'after', label: 'es después de' },
  ],
  urgency: [
    { value: 'is_any_of', label: 'tiene' },
    { value: 'has_not', label: 'no tiene urgencia' },
  ],
  labels: [
    { value: 'contains_any', label: 'contiene alguna de' },
    { value: 'contains_all', label: 'contiene todas' },
    { value: 'contains_none', label: 'no contiene ninguna de' },
  ],
  comments: [
    { value: 'has', label: 'tiene comentarios' },
    { value: 'has_not', label: 'no tiene comentarios' },
  ],
};

const MULTI_OPS = new Set<FilterOperator>([
  'is_any_of', 'is_none_of', 'contains_any', 'contains_all', 'contains_none',
]);

const OP_SHORT: Record<FilterOperator, string> = {
  contains:      'contiene',
  not_contains:  'no contiene',
  exact:         'exacto',
  is:            'es',
  is_not:        'no es',
  is_any_of:     'alguno de',
  is_none_of:    'ninguno de',
  after:         'después de',
  before:        'antes de',
  on:            'exacto',
  has:           'tiene',
  has_not:       'no tiene',
  contains_any:  'alguna de',
  contains_all:  'todas',
  contains_none: 'ninguna de',
};

// ── react-select styles ──────────────────────────────────────────────────────

type FieldOption = { value: FilterField; label: string };

const FIELD_OPTIONS: FieldOption[] = FIELDS.map((f) => ({ value: f, label: FIELD_LABELS[f] }));

const sharedSelectStyles: StylesConfig<FieldOption, false> = {
  indicatorsContainer: (base) => ({ ...base, height: '29px' }),
  indicatorSeparator: () => ({ display: 'none' }),
  valueContainer: (base) => ({ ...base, padding: '0 7px' }),
  input: (base) => ({ ...base, color: 'var(--text)', fontSize: '12px', margin: 0, padding: 0 }),
  menu: (base) => ({
    ...base,
    background: 'var(--bg-popup)',
    border: '0.5px solid var(--bd-md)',
    borderRadius: 'var(--r-md)',
    boxShadow: '0 4px 16px var(--shadow-lg)',
    overflow: 'hidden',
    fontSize: '12px',
    zIndex: 50,
  }),
  menuList: (base) => ({ ...base, padding: '4px' }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused ? 'var(--bg-hover)' : 'transparent',
    color: state.isSelected ? 'var(--primary)' : 'var(--text)',
    fontWeight: state.isSelected ? 500 : 400,
    borderRadius: 'var(--r-sm)',
    cursor: 'pointer',
    padding: '6px 10px',
    fontSize: '12px',
    '&:active': { background: 'var(--bg-hover)' },
  }),
};

const fieldSelectStyles: StylesConfig<FieldOption, false> = {
  ...sharedSelectStyles,
  control: (base, state) => ({
    ...base,
    minHeight: 'unset',
    height: '29px',
    background: 'var(--bg-input)',
    border: `0.5px solid ${state.isFocused ? 'var(--bd-md)' : 'var(--bd)'}`,
    borderRadius: 'var(--r-sm)',
    boxShadow: 'none',
    cursor: 'pointer',
    minWidth: '135px',
    '&:hover': { borderColor: 'var(--bd-md)' },
  }),
  singleValue: (base) => ({ ...base, color: 'var(--text)', fontSize: '12px', margin: 0 }),
  dropdownIndicator: (base) => ({ ...base, padding: '0 6px', color: 'var(--text-3)' }),
};

const addFilterSelectStyles: StylesConfig<FieldOption, false> = {
  ...sharedSelectStyles,
  control: (base) => ({
    ...base,
    minHeight: 'unset',
    height: '29px',
    background: 'var(--primary-bg)',
    border: '0.5px solid var(--primary-bd)',
    borderRadius: 'var(--r-md)',
    boxShadow: 'none',
    cursor: 'pointer',
    '&:hover': { opacity: 0.85 },
  }),
  placeholder: (base) => ({ ...base, color: 'var(--primary)', fontSize: '12px', fontWeight: 500, margin: 0 }),
  singleValue: (base) => ({ ...base, color: 'var(--primary)', fontSize: '12px', fontWeight: 500, margin: 0 }),
  dropdownIndicator: (base) => ({ ...base, padding: '0 6px', color: 'var(--primary)' }),
};

// ── Label chip input ─────────────────────────────────────────────────────────

function LabelChipInput({
  selected,
  allLabelNames,
  onChange,
}: {
  selected: string[];
  allLabelNames: string[];
  onChange: (names: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);

  const suggestions = allLabelNames.filter(
    (n) => n.toLowerCase().includes(input.toLowerCase()) && !selected.includes(n),
  );

  function add(name: string) {
    if (!selected.includes(name)) onChange([...selected, name]);
    setInput('');
    setOpen(false);
  }

  return (
    <div className="criterion-label-input-wrap">
      {selected.length > 0 && (
        <div className="criterion-label-selected-chips">
          {selected.map((name) => (
            <span key={name} className="criterion-label-chip">
              {name}
              <button onClick={() => onChange(selected.filter((n) => n !== name))}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="criterion-label-autocomplete">
        <input
          type="text"
          className="criterion-text-input"
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="label..."
        />
        {open && suggestions.length > 0 && (
          <div className="criterion-label-suggestions">
            {suggestions.map((n) => (
              <div key={n} className="criterion-label-suggestion-item" onMouseDown={() => add(n)}>
                {n}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single criterion row ─────────────────────────────────────────────────────

function CriterionRow({
  criterion,
  allLabelNames,
  onUpdate,
  onRemove,
}: {
  criterion: FilterCriterion;
  allLabelNames: string[];
  onUpdate: (updates: Partial<FilterCriterion>) => void;
  onRemove: () => void;
}) {
  const { field, operator, value } = criterion;
  const ops = OPERATORS_BY_FIELD[field];

  function handleFieldChange(newField: FilterField) {
    const newOp = OPERATORS_BY_FIELD[newField][0].value;
    const newVal: FilterCriterion['value'] =
      newField === 'status' || newField === 'urgency' || newField === 'labels' ? [] : null;
    onUpdate({ field: newField, operator: newOp, value: newVal });
  }

  function handleOpChange(newOp: FilterOperator) {
    if (newOp === 'has' || newOp === 'has_not') {
      onUpdate({ operator: newOp, value: null });
      return;
    }
    const newIsMulti = MULTI_OPS.has(newOp);
    const oldIsMulti = MULTI_OPS.has(operator);
    if (oldIsMulti === newIsMulti) {
      onUpdate({ operator: newOp });
    } else if (oldIsMulti && !newIsMulti) {
      const first = Array.isArray(value) && value.length > 0 ? value[0] : null;
      onUpdate({ operator: newOp, value: first });
    } else {
      const arr = typeof value === 'string' && value ? [value] : [];
      onUpdate({ operator: newOp, value: arr });
    }
  }

  function renderValue() {
    if (field === 'comments') return null;
    if (field === 'urgency' && operator === 'has_not') return null;

    if (field === 'name' || field === 'body') {
      return (
        <input
          type="text"
          className="criterion-text-input"
          value={(value as string) ?? ''}
          onChange={(e) => onUpdate({ value: e.target.value || null })}
          placeholder="valor..."
        />
      );
    }

    if (field === 'status') {
      const isMulti = operator === 'is_any_of' || operator === 'is_none_of';
      const sel: TaskStatus[] = Array.isArray(value)
        ? (value as TaskStatus[])
        : value ? [value as TaskStatus] : [];
      return (
        <div className="criterion-chips">
          {STATES.map((s) => {
            const active = sel.includes(s);
            return (
              <button
                key={s}
                className={`criterion-chip${active ? ' active' : ''}`}
                style={active ? { background: STATE_BG[s], color: STATE_COLORS[s], borderColor: STATE_COLORS[s] } : undefined}
                onClick={() => {
                  if (isMulti) {
                    const next = active ? sel.filter((x) => x !== s) : [...sel, s];
                    onUpdate({ value: next });
                  } else {
                    onUpdate({ value: active ? null : s });
                  }
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      );
    }

    if (field === 'kind') {
      return (
        <select
          className="criterion-select"
          value={(value as string) ?? ''}
          onChange={(e) => onUpdate({ value: e.target.value || null })}
        >
          <option value="">—</option>
          {TASK_KINDS.map((k) => (
            <option key={k} value={k}>{TASK_KIND_LABELS[k]}</option>
          ))}
        </select>
      );
    }

    if (field === 'createdAt' || field === 'dueOrNextDate') {
      return (
        <input
          type="date"
          className="criterion-date-input"
          value={(value as string) ?? ''}
          onChange={(e) => onUpdate({ value: e.target.value || null })}
        />
      );
    }

    if (field === 'urgency') {
      const sel: UrgencyLevel[] = Array.isArray(value) ? (value as UrgencyLevel[]) : [];
      return (
        <div className="criterion-chips">
          {URGENCY_LEVELS.map((u) => {
            const active = sel.includes(u);
            return (
              <button
                key={u}
                className={`criterion-chip${active ? ' active' : ''}`}
                title={URGENCY[u].title}
                onClick={() => {
                  const next = active ? sel.filter((x) => x !== u) : [...sel, u];
                  onUpdate({ value: next });
                }}
              >
                {URGENCY[u].icon} {URGENCY[u].title}
              </button>
            );
          })}
        </div>
      );
    }

    if (field === 'labels') {
      return (
        <LabelChipInput
          selected={Array.isArray(value) ? (value as string[]) : []}
          allLabelNames={allLabelNames}
          onChange={(names) => onUpdate({ value: names })}
        />
      );
    }

    return null;
  }

  return (
    <div className="criterion-row">
      <ReactSelect<FieldOption, false>
        value={{ value: field, label: FIELD_LABELS[field] }}
        onChange={(opt) => opt && handleFieldChange(opt.value)}
        options={FIELD_OPTIONS}
        styles={fieldSelectStyles}
        isSearchable={false}
        menuPortalTarget={document.body}
        menuPosition="fixed"
      />
      <ToggleGroup.Root
        type="single"
        value={operator}
        onValueChange={(v) => v && handleOpChange(v as FilterOperator)}
        className="op-toggle"
      >
        {ops.map((op) => (
          <ToggleGroup.Item
            key={op.value}
            value={op.value}
            className="op-btn"
            title={op.label}
          >
            {OP_SHORT[op.value]}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <div className="criterion-value">{renderValue()}</div>
      <button className="criterion-remove-btn" onClick={onRemove} title="Quitar filtro">×</button>
    </div>
  );
}

// ── PQL help table ───────────────────────────────────────────────────────────

function PQLHelpContent() {
  return (
    <div className="pql-help-content">
      <table className="pql-help-table">
        <thead>
          <tr><th>Campo</th><th>Operadores</th><th>Valores de ejemplo</th></tr>
        </thead>
        <tbody>
          <tr><td>name, body</td><td>IS, NOT IS, CONTAINS, NOT CONTAINS</td><td>&quot;texto&quot;, EMPTY</td></tr>
          <tr><td>status</td><td>IS, NOT IS, IN, NOT IN</td><td>&apos;Backlog&apos;, (&apos;Backlog&apos;, &apos;Ejecución&apos;)</td></tr>
          <tr><td>kind</td><td>IS, NOT IS</td><td>&apos;ONE_TIME&apos;, &apos;RECURRING&apos;</td></tr>
          <tr><td>createdAt, dueDate, nextDate</td><td>IS, NOT IS, BEFORE, AFTER</td><td>&quot;31/03/2026&quot;, currentDate()</td></tr>
          <tr><td>labels</td><td>CONTAINS, NOT CONTAINS, CONTAINS_ALL, HAS, NOT HAS</td><td>&quot;urgente&quot;, (&quot;a&quot;, &quot;b&quot;)</td></tr>
          <tr><td>comments</td><td>HAS, NOT HAS</td><td>—</td></tr>
          <tr><td>urgency</td><td>IN, NOT IN, HAS, NOT HAS</td><td>(&apos;warning&apos;, &apos;alert&apos;, &apos;overdue&apos;)</td></tr>
          <tr><td>commentsCount()</td><td>{'>'} {'<'} {'>='} {'<='} = !=</td><td>0, 1, 5</td></tr>
          <tr><td>labelsCount()</td><td>{'>'} {'<'} {'>='} {'<='} = !=</td><td>0, 1, 5</td></tr>
        </tbody>
      </table>
      <p className="pql-help-note">
        Usa <strong>AND</strong> / <strong>OR</strong> para combinar condiciones. Los paréntesis agrupan y se resuelven de adentro hacia afuera. La sintaxis no distingue mayúsculas de minúsculas.
      </p>
    </div>
  );
}

// ── PQL filter panel ─────────────────────────────────────────────────────────

function PQLFilterContent({
  pqlQuery,
  pqlError,
  allTasks,
  onPqlChange,
  onPqlEvaluated,
}: {
  pqlQuery: string;
  pqlError?: string;
  allTasks: Task[];
  onPqlChange: (q: string) => void;
  onPqlEvaluated: (tasks: Task[] | null, error?: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      const result = evaluatePQL(pqlQuery, allTasks);
      if (result.error) {
        onPqlEvaluated(null, result.error);
      } else {
        onPqlEvaluated(result.tasks, undefined);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [pqlQuery, allTasks]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pql-panel">
      <textarea
        className={`pql-input${pqlError ? ' pql-input--error' : ''}`}
        value={pqlQuery}
        onChange={(e) => onPqlChange(e.target.value)}
        placeholder={`name CONTAINS "Pago" AND status NOT IN ('Finalizado', 'Cancelado')`}
        rows={2}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
      />
      {pqlError && (
        <div className="pql-error" role="alert">
          ⚠️ {pqlError}
        </div>
      )}
      <div className="pql-help">
        <details>
          <summary>Referencia rápida de campos y operadores</summary>
          <PQLHelpContent />
        </details>
      </div>
    </div>
  );
}

// ── Visual filter content ────────────────────────────────────────────────────

function VisualFilterContent({
  criteria,
  allLabelNames,
  onAddCriterion,
  onUpdateCriterion,
  onRemoveCriterion,
}: {
  criteria: FilterCriterion[];
  allLabelNames: string[];
  onAddCriterion: (field: FilterField) => void;
  onUpdateCriterion: (id: string, updates: Partial<FilterCriterion>) => void;
  onRemoveCriterion: (id: string) => void;
}) {
  return (
    <>
      {criteria.map((c) => (
        <CriterionRow
          key={c.id}
          criterion={c}
          allLabelNames={allLabelNames}
          onUpdate={(updates) => onUpdateCriterion(c.id, updates)}
          onRemove={() => onRemoveCriterion(c.id)}
        />
      ))}
      <div className="filter-footer">
        <ReactSelect<FieldOption, false>
          value={null}
          onChange={(opt) => { if (opt) onAddCriterion(opt.value); }}
          options={FIELD_OPTIONS}
          styles={addFilterSelectStyles}
          isSearchable={false}
          placeholder="＋ Agregar filtro"
          menuPortalTarget={document.body}
          menuPosition="fixed"
        />
      </div>
    </>
  );
}

// ── Match count legend ───────────────────────────────────────────────────────

function MatchCountLegend({
  matchCount,
  totalCount,
  hasFilter,
}: {
  matchCount: number;
  totalCount: number;
  hasFilter: boolean;
}) {
  if (!hasFilter) return null;
  if (matchCount === totalCount) return null;
  if (matchCount === 0) {
    return <span className="filter-match-count filter-match-count--empty">Sin resultados</span>;
  }
  return (
    <span className="filter-match-count">
      {matchCount} {matchCount === 1 ? 'coincidencia' : 'coincidencias'}
    </span>
  );
}

// ── FilterBarControls ────────────────────────────────────────────────────────

interface FilterBarControlsProps {
  nameSearch: string;
  activeCount: number;
  expanded: boolean;
  mode: FilterMode;
  matchCount: number;
  totalCount: number;
  onNameSearchChange: (v: string) => void;
  onToggleExpanded: () => void;
  onClearAll: () => void;
  onModeChange: (m: FilterMode) => void;
}

export function FilterBarControls({
  nameSearch,
  activeCount,
  expanded,
  mode,
  matchCount,
  totalCount,
  onNameSearchChange,
  onToggleExpanded,
  onClearAll,
}: FilterBarControlsProps) {
  const hasAnyFilter = activeCount > 0 || nameSearch.trim() !== '';

  return (
    <>
      {mode === 'visual' && (
        <div className="filter-name-wrap">
          <span className="filter-name-icon">🔍</span>
          <input
            type="text"
            className="filter-name-input"
            placeholder="Buscar por nombre..."
            value={nameSearch}
            onChange={(e) => onNameSearchChange(e.target.value)}
          />
        </div>
      )}
      <button
        className={`filter-toggle-btn${expanded ? ' active' : ''}`}
        onClick={onToggleExpanded}
      >
        <span className="btn-label">{mode === 'query' ? 'PQL' : 'Filtros'}</span>
        <span className="btn-icon">{expanded ? '▲' : '▼'}</span>
        {activeCount > 0 && <span className="filter-count-badge">{activeCount}</span>}
      </button>
      {hasAnyFilter && (
        <button className="filter-clear-btn" onClick={onClearAll}>
          × Limpiar
        </button>
      )}
      <MatchCountLegend matchCount={matchCount} totalCount={totalCount} hasFilter={hasAnyFilter} />
    </>
  );
}

// ── FilterCriteriaPanel ──────────────────────────────────────────────────────

interface FilterCriteriaPanelProps {
  criteria: FilterCriterion[];
  allLabelNames: string[];
  expanded: boolean;
  mode: FilterMode;
  pqlQuery: string;
  pqlError?: string;
  allTasks: Task[];
  onPqlChange: (q: string) => void;
  onPqlEvaluated: (tasks: Task[] | null, error?: string) => void;
  onModeChange: (m: FilterMode) => void;
  onAddCriterion: (field: FilterField) => void;
  onUpdateCriterion: (id: string, updates: Partial<FilterCriterion>) => void;
  onRemoveCriterion: (id: string) => void;
}

export function FilterCriteriaPanel(props: FilterCriteriaPanelProps) {
  if (!props.expanded) return null;

  return (
    <div className="filter-criteria-panel">
      <div className="filter-mode-toggle">
        <button
          className={`filter-mode-btn${props.mode === 'visual' ? ' active' : ''}`}
          onClick={() => props.onModeChange('visual')}
        >
          Visual
        </button>
        <button
          className={`filter-mode-btn${props.mode === 'query' ? ' active' : ''}`}
          onClick={() => props.onModeChange('query')}
        >
          PQL
        </button>
      </div>

      {props.mode === 'visual' ? (
        <VisualFilterContent
          criteria={props.criteria}
          allLabelNames={props.allLabelNames}
          onAddCriterion={props.onAddCriterion}
          onUpdateCriterion={props.onUpdateCriterion}
          onRemoveCriterion={props.onRemoveCriterion}
        />
      ) : (
        <PQLFilterContent
          pqlQuery={props.pqlQuery}
          pqlError={props.pqlError}
          allTasks={props.allTasks}
          onPqlChange={props.onPqlChange}
          onPqlEvaluated={props.onPqlEvaluated}
        />
      )}
    </div>
  );
}
