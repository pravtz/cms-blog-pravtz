import styles from './CommentSystemPlaceholder.module.css'

export default function CommentSystemPlaceholder() {
  return (
    <section className={styles.section} aria-label="Comentários">
      <h2 className={styles.heading}>Comentários</h2>
      <div className={styles.placeholder}>
        <p className={styles.text}>
          O sistema de comentários estará disponível em breve.
        </p>
      </div>
    </section>
  )
}
