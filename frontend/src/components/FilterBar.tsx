import { useState } from 'react';
import type { FilterCriterion, FilterField, FilterOperator, TaskStatus, UrgencyLevel } from '../types';
import { STATES, STATE_BG, STATE_COLORS, URGENCY, TASK_KINDS, TASK_KIND_LABELS } from '../types';

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
          {(['warning', 'alert', 'overdue'] as UrgencyLevel[]).map((u) => {
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
      <select
        className="criterion-field-select"
        value={field}
        onChange={(e) => handleFieldChange(e.target.value as FilterField)}
      >
        {FIELDS.map((f) => (
          <option key={f} value={f}>{FIELD_LABELS[f]}</option>
        ))}
      </select>
      <select
        className="criterion-op-select"
        value={operator}
        onChange={(e) => handleOpChange(e.target.value as FilterOperator)}
      >
        {ops.map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>
      <div className="criterion-value">{renderValue()}</div>
      <button className="criterion-remove-btn" onClick={onRemove} title="Quitar filtro">×</button>
    </div>
  );
}

// ── FilterBar ────────────────────────────────────────────────────────────────

interface FilterBarProps {
  nameSearch: string;
  criteria: FilterCriterion[];
  activeCount: number;
  allLabelNames: string[];
  onNameSearchChange: (v: string) => void;
  onAddCriterion: (field: FilterField) => void;
  onUpdateCriterion: (id: string, updates: Partial<FilterCriterion>) => void;
  onRemoveCriterion: (id: string) => void;
  onClearAll: () => void;
}

export function FilterBar({
  nameSearch,
  criteria,
  activeCount,
  allLabelNames,
  onNameSearchChange,
  onAddCriterion,
  onUpdateCriterion,
  onRemoveCriterion,
  onClearAll,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const hasAnyFilter = nameSearch.trim() !== '' || activeCount > 0;

  return (
    <div className="filter-bar">
      <div className="filter-bar-main">
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
        <button
          className={`filter-toggle-btn${expanded ? ' active' : ''}`}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '▲' : '▼'} Filtros
          {activeCount > 0 && <span className="filter-count-badge">{activeCount}</span>}
        </button>
        {hasAnyFilter && (
          <button className="filter-clear-btn" onClick={onClearAll}>
            × Limpiar
          </button>
        )}
      </div>

      {expanded && (
        <div className="filter-criteria-panel">
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
            <select
              className="filter-add-select"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  onAddCriterion(e.target.value as FilterField);
                  (e.target as HTMLSelectElement).value = '';
                }
              }}
            >
              <option value="" disabled>+ Agregar filtro</option>
              {FIELDS.map((f) => (
                <option key={f} value={f}>{FIELD_LABELS[f]}</option>
              ))}
            </select>
            <span className="filter-query-hint">Modo query <em>(próximamente)</em></span>
          </div>
        </div>
      )}
    </div>
  );
}
