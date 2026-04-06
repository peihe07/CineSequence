'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import styles from './about.module.css'

const PARAGRAPHS_ZH = [
  '我對電影的感覺一直都很彆扭。',
  '像是《巴黎，德州》重映，我每次都會去看，但心裡其實恨透了 Travis 和 Jane。劇情裡那種「為了對方好」而不肯傾訴的沈默，在我看來不過是種自以為是。拋開那些絕美的公路運鏡，這故事講穿了就是一對極其不負責任的父母。',
  '諷刺的是，這部片真的美到讓我每次都看到忘我，直到結尾才猛然想起那股氣憤。回到家，發現房間牆上依然掛著 Jane 最美的那張海報——這就是電影給我的、那種讓人無言以對的複雜感受。',
  '我之所以想做 CineSequence，是因為我真的很迷戀這種純粹的偏執。',
  '我喜歡《沙丘魔堡》裡那種冷冽、奇怪的科技感，也著迷於《霓裳魅影》那種近乎病態的畸形戀愛。我甚至在想，有沒有可能像《（非）一般欲望》那樣，兩個人不需要對話，僅僅是因為看著同一個噴水池，就能確認彼此的存在？',
  '我不打算在這裡設立什麼制式的使用標準。在這裡，每個人進來就是一張票券。',
  '妳想在上面顯示什麼，我不會硬性規定。妳可以寫滿對某種事物的瘋狂偏執，也可以什麼都不留，只剩下一個 Email。或許妳根本不想社交，只是想從這個連結裡透口氣，在道德是非的邊緣找一個不需要解釋的噴水池，安靜地待著。',
  '我理解在快速流動的環境中，這種留白會讓人感到盲目。但我更希望，妳是透過一段水聲、一個無人的空鏡、或是一份偏執的共鳴，去認出那個頻率一致的人。',
  '如果你覺得「沒看這麼多電影怎麼玩」或是「為什麼只給 Email」，那這裡真的不適合讓你拿來當交友軟體用。',
  '我可以給你們連結，但剩下的東西，請你們自己帶著耐心與勇氣去建立。我們不需要向世界解釋自己為什麼這麼複雜。因為在兩張票券交疊的那一刻，我們就已經在同一個噴水池旁認出了彼此。',
]

const PARAGRAPHS_EN = [
  'My relationship with cinema has always been awkward.',
  'Whenever Paris, Texas gets a rerun, I go see it — every single time. But deep down, I despise Travis and Jane. That silence — the kind dressed up as "for your own good" — is just self-righteousness to me. Strip away the breathtaking road cinematography, and what you have is a story about two profoundly irresponsible parents.',
  'The irony is, the film is so beautiful that I lose myself every time, only to feel that anger crash back at the end. I get home and find Jane\'s most beautiful poster still hanging on my wall — that\'s the kind of wordless complexity cinema gives me.',
  'The reason I wanted to build CineSequence is because I\'m truly obsessed with this kind of pure fixation.',
  'I love the cold, strange techno-feel in Dune, and I\'m fascinated by the almost pathological romance in Phantom Thread. I even wonder: is it possible — like in (Non) Ordinary Desire — for two people to confirm each other\'s existence without a single word, just by watching the same fountain?',
  'I have no intention of setting up rigid usage standards here. Here, everyone who walks in is a ticket.',
  'What you choose to show on it is entirely up to you. You can fill it with an obsessive fixation for something, or leave it completely blank with nothing but an email. Maybe you don\'t want to socialize at all — you just want to breathe through this link, finding a fountain on the edge of moral certainty where you can sit quietly without explaining yourself.',
  'I understand that in a fast-moving world, this kind of blankness can feel disorienting. But I\'d rather you recognize someone through the sound of water, an empty shot with no one in frame, or a shared obsessive resonance — someone whose frequency matches yours.',
  'If you think "I haven\'t seen enough films to play" or "why only an email," then this really isn\'t the place for you to use as a dating app.',
  'I can give you a link. But what comes after — please build it yourselves, with patience and courage. We don\'t need to explain to the world why we\'re this complicated. Because the moment two tickets overlap, we\'ve already recognized each other by the same fountain.',
]

export default function AboutClient() {
  const { locale } = useI18n()
  const paragraphs = locale === 'zh' ? PARAGRAPHS_ZH : PARAGRAPHS_EN

  return (
    <main className={styles.page}>
      <div className={styles.grain} aria-hidden="true" />

      <article className={styles.article}>
        <header className={styles.header}>
          <span className={styles.kicker}>About</span>
          <h1 className={styles.title}>
            {locale === 'zh'
              ? '在這裡，每個人進來就是一張票券'
              : 'Here, everyone who walks in is a ticket'}
          </h1>
        </header>

        <div className={styles.body}>
          {paragraphs.map((p, i) => (
            <p key={i} className={styles.paragraph}>
              {p}
            </p>
          ))}
        </div>

        <div className={styles.signature}>
          <span className={styles.signatureName}>— peihe</span>
        </div>

        <footer className={styles.footer}>
          <Link href="/" className={styles.backLink}>
            <i className="ri-arrow-left-line" />
            <span>{locale === 'zh' ? '回到首頁' : 'Back'}</span>
          </Link>
        </footer>
      </article>
    </main>
  )
}
