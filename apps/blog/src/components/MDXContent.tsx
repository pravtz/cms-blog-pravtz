import styles from './MDXContent.module.css'

interface MDXContentProps {
  html: string
}

export default function MDXContent({ html }: MDXContentProps) {
  return (
    <article
      className={styles.content}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
