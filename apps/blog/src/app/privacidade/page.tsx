import type { Metadata } from 'next'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Saiba como coletamos, usamos e protegemos seus dados pessoais.',
  robots: { index: true, follow: true },
}

export default function PrivacidadePage() {
  const updated = '10 de abril de 2026'

  return (
    <main className={styles.main}>
      <article className={styles.article}>
        <header className={styles.header}>
          <h1 className={styles.title}>Política de Privacidade</h1>
          <p className={styles.updated}>Última atualização: {updated}</p>
        </header>

        <div className={styles.content}>
          <section>
            <h2>1. Introdução</h2>
            <p>
              Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos
              suas informações pessoais ao utilizar este blog, em conformidade com a Lei Geral de
              Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2>2. Dados que Coletamos</h2>
            <p>Podemos coletar as seguintes categorias de dados:</p>
            <ul>
              <li>
                <strong>Dados de navegação:</strong> endereço IP, tipo de navegador, páginas
                visitadas e data/hora de acesso (via logs do servidor e, se habilitado, analytics).
              </li>
              <li>
                <strong>Newsletter:</strong> endereço de e-mail fornecido voluntariamente ao se
                inscrever em nossa newsletter.
              </li>
              <li>
                <strong>Conta de usuário:</strong> nome, e-mail, senha (armazenada em hash
                irreversível) e preferências, caso você crie uma conta.
              </li>
              <li>
                <strong>Comentários:</strong> conteúdo dos comentários publicados e dados
                identificadores do autor.
              </li>
            </ul>
          </section>

          <section>
            <h2>3. Finalidade do Tratamento</h2>
            <p>Utilizamos seus dados para:</p>
            <ul>
              <li>Enviar a newsletter à qual você se inscreveu voluntariamente;</li>
              <li>Gerenciar sua conta e autenticação;</li>
              <li>Melhorar o desempenho e a experiência de navegação no blog;</li>
              <li>Moderar comentários e proteger a comunidade;</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
            </ul>
          </section>

          <section>
            <h2>4. Base Legal</h2>
            <p>
              O tratamento dos seus dados se baseia em uma ou mais das seguintes bases legais
              previstas na LGPD:
            </p>
            <ul>
              <li>
                <strong>Consentimento</strong> (art. 7º, I) — newsletter e cookies não essenciais;
              </li>
              <li>
                <strong>Legítimo interesse</strong> (art. 7º, IX) — analytics e logs de segurança;
              </li>
              <li>
                <strong>Execução de contrato</strong> (art. 7º, V) — contas de usuário.
              </li>
            </ul>
          </section>

          <section>
            <h2>5. Compartilhamento de Dados</h2>
            <p>
              Não vendemos nem compartilhamos seus dados pessoais com terceiros para fins comerciais.
              Podemos compartilhar dados com prestadores de serviço essenciais (ex.: provedores de
              e-mail para envio da newsletter), sempre mediante garantias contratuais de
              confidencialidade e segurança.
            </p>
          </section>

          <section>
            <h2>6. Armazenamento e Segurança</h2>
            <p>
              Seus dados são armazenados em servidores seguros. Adotamos medidas técnicas e
              organizacionais adequadas para proteger suas informações contra acesso não autorizado,
              perda ou destruição, incluindo criptografia de senhas e tokens de acesso.
            </p>
          </section>

          <section>
            <h2>7. Retenção de Dados</h2>
            <p>
              Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas nesta
              política ou pelo prazo exigido por lei. Dados de newsletter são excluídos mediante
              solicitação ou após o cancelamento da inscrição, respeitados os prazos legais de
              guarda.
            </p>
          </section>

          <section>
            <h2>8. Seus Direitos (LGPD)</h2>
            <p>Nos termos da LGPD, você tem o direito de:</p>
            <ul>
              <li>Confirmar a existência de tratamento dos seus dados;</li>
              <li>Acessar seus dados;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>Solicitar a portabilidade dos dados;</li>
              <li>Revogar o consentimento a qualquer momento;</li>
              <li>Opor-se ao tratamento realizado com fundamento em outras bases legais.</li>
            </ul>
            <p>
              Para exercer seus direitos, entre em contato pelo e-mail indicado na seção de contato
              deste blog.
            </p>
          </section>

          <section>
            <h2>9. Newsletter — Cancelamento</h2>
            <p>
              Você pode cancelar sua inscrição na newsletter a qualquer momento clicando no link
              de cancelamento presente em cada e-mail enviado. O cancelamento é imediato e seus
              dados de inscrição serão marcados como inativos.
            </p>
          </section>

          <section>
            <h2>10. Cookies</h2>
            <p>
              Este blog pode utilizar cookies essenciais para funcionamento (autenticação de sessão)
              e cookies analíticos (se habilitados pelo administrador). Você pode desativar cookies
              não essenciais nas configurações do seu navegador.
            </p>
          </section>

          <section>
            <h2>11. Alterações nesta Política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Alterações relevantes serão comunicadas
              com destaque no site. Recomendamos revisitar esta página regularmente.
            </p>
          </section>

          <section>
            <h2>12. Contato</h2>
            <p>
              Dúvidas sobre esta política ou sobre o tratamento dos seus dados? Entre em contato
              com o responsável pelo blog por meio do formulário de contato ou do e-mail
              disponível na página inicial.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
