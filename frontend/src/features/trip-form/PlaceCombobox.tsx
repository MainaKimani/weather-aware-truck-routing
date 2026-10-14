/**
 * Origin / destination input with suggestions: an ARIA 1.2 combobox
 * (downshift provides roles, active descendant and keyboard handling:
 * arrows, Enter, Escape). Typing clears the picked place, so coordinates
 * always match the label shown.
 */
import { useCombobox } from 'downshift'
import { useId } from 'react'

import { ApiError } from '../../api/errors'
import { MIN_QUERY, usePlaceSuggestions } from '../../api/places'
import type { Place } from '../../api/schema'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { PlaceValue } from './schema'

export const DEBOUNCE_MS = 300

interface PlaceComboboxProps {
  label: string
  value: PlaceValue
  onChange: (value: PlaceValue) => void
  onBlur?: () => void
  error?: string
  /** Shown in the label row, e.g. the zone abbreviation for the origin. */
  adornment?: React.ReactNode
  name: string
}

const placeKey = (p: Place) => `${p.label}|${String(p.lat)}|${String(p.lon)}`

export function PlaceCombobox(props: PlaceComboboxProps) {
  const { label, value, onChange, onBlur, error, adornment, name } = props
  const query = useDebouncedValue(value.place ? '' : value.text, DEBOUNCE_MS)
  const suggestions = usePlaceSuggestions(query)
  const items = suggestions.data ?? []
  const errorId = useId()

  const { isOpen, highlightedIndex, getLabelProps, getInputProps, getMenuProps, getItemProps } =
    useCombobox<Place>({
      items,
      itemToString: (p) => p?.label ?? '',
      itemToKey: (p) => (p ? placeKey(p) : null),
      selectedItem: value.place,
      inputValue: value.text,
      onSelectedItemChange: ({ selectedItem }) => {
        onChange({ text: selectedItem?.label ?? value.text, place: selectedItem ?? null })
      },
    })

  const searching = value.text.trim().length >= MIN_QUERY && !value.place
  const showMenu = isOpen && searching

  return (
    <div className="relative">
      <div className="flex items-baseline justify-between">
        <label {...getLabelProps()} className="text-sm font-medium">
          {label}
        </label>
        {adornment}
      </div>
      <input
        {...getInputProps({
          onBlur,
          name,
          // Typed text goes to the form in the input's own change handler, not
          // downshift's onInputValueChange, which runs after render: React
          // resets a controlled input whose value isn't updated during the
          // event, so fast typing would drop characters.
          onChange: (e) => {
            onChange({ text: e.currentTarget.value, place: null })
          },
        })}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder="City or address"
        className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted aria-invalid:border-danger"
      />
      <ul
        {...getMenuProps()}
        className={
          showMenu
            ? 'absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-surface-raised py-1 text-sm shadow-overlay'
            : 'hidden'
        }
      >
        {showMenu &&
          items.map((place, index) => (
            <li
              key={placeKey(place)}
              {...getItemProps({ item: place, index })}
              className={`cursor-pointer px-3 py-1.5 ${highlightedIndex === index ? 'bg-accent text-accent-ink' : ''}`}
            >
              {place.label}
            </li>
          ))}
        {showMenu && items.length === 0 && (
          <li className="px-3 py-1.5 text-muted" aria-disabled="true">
            {suggestions.isError
              ? suggestions.error instanceof ApiError && suggestions.error.code === 'quota_reached'
                ? "Place search is paused until next month: this month's allowance is used up."
                : 'Place search is unavailable. Try again shortly.'
              : suggestions.isFetching || query !== value.text
                ? 'Searching…'
                : 'No matches'}
          </li>
        )}
      </ul>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
