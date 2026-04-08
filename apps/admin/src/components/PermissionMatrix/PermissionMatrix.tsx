'use client'

import styles from './PermissionMatrix.module.css'
import {
  ALL_RESOURCES,
  ALL_OPERATIONS,
  RESOURCE_LABELS,
  OPERATION_LABELS,
} from '@/lib/rbac'
import type { Resource, Operation } from '@/lib/rbac'

export type PermissionMap = Record<Resource, Record<Operation, boolean>>

interface Props {
  permissions: PermissionMap
  readOnly?: boolean
  onChange?: (resource: Resource, operation: Operation, value: boolean) => void
  /** If true, entire matrix is disabled (e.g., owner group) */
  disabled?: boolean
}

export default function PermissionMatrix({
  permissions,
  readOnly = false,
  onChange,
  disabled = false,
}: Props) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table} role="grid" aria-label="Permission matrix">
        <thead>
          <tr>
            <th className={styles.resourceHeader}>Resource</th>
            {ALL_OPERATIONS.map((op) => (
              <th key={op} className={styles.opHeader}>
                {OPERATION_LABELS[op]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_RESOURCES.map((resource) => (
            <tr key={resource} className={styles.row}>
              <td className={styles.resourceLabel}>{RESOURCE_LABELS[resource]}</td>
              {ALL_OPERATIONS.map((operation) => {
                const checked = permissions[resource]?.[operation] ?? false
                const id = `perm-${resource}-${operation}`
                return (
                  <td key={operation} className={styles.cell}>
                    <label htmlFor={id} className={styles.checkLabel}>
                      <input
                        id={id}
                        type="checkbox"
                        className={styles.checkbox}
                        checked={checked}
                        disabled={readOnly || disabled}
                        aria-label={`${RESOURCE_LABELS[resource]} — ${OPERATION_LABELS[operation]}`}
                        onChange={(e) => {
                          if (!readOnly && !disabled && onChange) {
                            onChange(resource, operation, e.target.checked)
                          }
                        }}
                      />
                      <span className="sr-only">
                        {RESOURCE_LABELS[resource]} {OPERATION_LABELS[operation]}
                      </span>
                    </label>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
