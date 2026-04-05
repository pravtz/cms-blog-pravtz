import React from 'react'
import styles from './Input.module.css'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'suffix'> {
  label?: string
  hint?: string
  error?: string
  prefix?: React.ReactNode
  suffix?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { label, hint, error, prefix, suffix, className, id, required, ...rest },
    ref,
  ) {
    const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
    const errorId = error ? `${inputId}-error` : undefined

    const wrapperClass = [
      styles.inputWrapper,
      prefix ? styles.hasPrefix : '',
      suffix ? styles.hasSuffix : '',
    ]
      .filter(Boolean)
      .join(' ')

    const inputClass = [styles.input, error ? styles.inputError : '', className ?? '']
      .filter(Boolean)
      .join(' ')

    return (
      <div className={styles.wrapper}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
            {required && <span className={styles.required} aria-hidden="true"> *</span>}
          </label>
        )}

        <div className={wrapperClass}>
          {prefix && <span className={styles.prefix}>{prefix}</span>}

          <input
            ref={ref}
            id={inputId}
            className={inputClass}
            required={required}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={errorId ?? (hint ? `${inputId}-hint` : undefined)}
            {...rest}
          />

          {suffix && <span className={styles.suffix}>{suffix}</span>}
        </div>

        {hint && !error && (
          <span id={`${inputId}-hint`} className={styles.hint}>
            {hint}
          </span>
        )}

        {error && (
          <span id={errorId} className={styles.errorText} role="alert">
            {error}
          </span>
        )}
      </div>
    )
  },
)
