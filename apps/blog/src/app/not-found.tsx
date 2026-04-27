import Link from 'next/link'

export const metadata = {
  title: 'Página não encontrada',
  description: 'A página que você procura não existe.',
}

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>404</h1>
      <p style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>
        Não conseguimos encontrar a página que você procura.
      </p>
      <Link
        href="/"
        style={{
          textDecoration: 'underline',
          textUnderlineOffset: 2,
          color: 'var(--accent, #2563eb)',
        }}
      >
        Voltar para o início
      </Link>
    </main>
  )
}
