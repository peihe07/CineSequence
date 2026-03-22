'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type Locale = 'zh' | 'en'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: (key) => key,
})

const STORAGE_KEY = 'cinesequence-locale'

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (saved === 'zh' || saved === 'en') {
      setLocaleState(saved)
    }
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const dict = translations[locale]
      let text = dict[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replaceAll(`{{${k}}}`, String(v))
        }
      }
      return text
    },
    [locale],
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

// Translation dictionaries
const translations: Record<Locale, Record<string, string>> = {
  zh: {
    // Common
    'common.loading': '載入中...',
    'common.error': '發生錯誤',
    'common.back': '返回',
    'common.confirm': '確認',
    'common.cancel': '取消',

    // Nav
    'nav.sequencing': '序列',
    'nav.dna': 'DNA',
    'nav.matches': '配對',
    'nav.theaters': '放映廳',
    'nav.profile': '檔案',

    // Auth
    'auth.signIn': '登入',
    'auth.signUp': '註冊',
    'auth.subtitle': '透過電影選擇，解碼你的觀影 DNA',
    'auth.emailPlaceholder': '輸入 email',
    'auth.sendLink': '發送登入連結',
    'auth.sending': '發送中...',
    'auth.verifying': '驗證中...',
    'auth.verified': '驗證完成',
    'auth.verifyFailed': '驗證失敗',
    'auth.invalidLink': '連結無效或已過期',
    'auth.newLink': '重新取得連結',
    'auth.redirecting': '正在跳轉...',
    'auth.checkEmail': '請查看你的信箱',
    'auth.checkEmailSent': '已寄出登入連結至 {{email}}',
    'auth.tryOther': '使用其他 email',
    'auth.invalidEmail': '請輸入有效的 email',
    'auth.noAccount': '還沒有帳號？',
    'auth.hasAccount': '已有帳號？',
    'auth.backToLogin': '返回登入',

    // Register
    'register.title': '建立帳號',
    'register.subtitle': '開始你的 Cine Sequence',
    'register.name': '顯示名稱',
    'register.namePlaceholder': '你希望怎麼被稱呼',
    'register.nameRequired': '請輸入名稱',
    'register.gender': '性別',
    'register.genderMale': '男',
    'register.genderFemale': '女',
    'register.genderOther': '其他',
    'register.genderSkip': '不透露',
    'register.genderRequired': '請選擇性別',
    'register.birthYear': '出生年份',
    'register.submit': '註冊',

    // Preferences
    'pref.title': '配對偏好',
    'pref.genderPref': '想配對的性別',
    'pref.any': '不限',
    'pref.ageRange': '年齡範圍',
    'pref.pureTaste': '純品味配對',
    'pref.pureTasteHint': '忽略性別與年齡，僅以觀影品味配對',
    'pref.save': '儲存偏好',

    // Sequencing
    'seq.phase': '第 {{phase}} 階段',
    'seq.round': '第 {{round}} / {{total}} 輪',
    'seq.skip': '跳過',
    'seq.skipBoth': '都沒看過',
    'seq.watched': '看過這部',
    'seq.attracted': '更想看這部',

    // Sequencing - Seed
    'seed.title': '選擇你的起點',
    'seed.subtitle': '選一部代表你品味的電影，作為序列分析的校準基準。',
    'seed.placeholder': '搜尋電影名稱...',
    'seed.confirm': '開始序列分析',
    'seed.skip': '跳過此步驟',
    'seed.searching': '搜尋中...',

    // Sequencing - Complete
    'complete.title': 'Sequencing Complete',
    'complete.subtitle': '已完成 {{total}} 輪序列分析，你的觀影 DNA 已就緒。',
    'complete.rounds': '輪數',
    'complete.extensions': '延伸',
    'complete.viewDna': '查看 DNA 結果',
    'complete.extend': '延伸分析（+5 輪）',
    'complete.extendHint': '追加 5 輪可提升分析精度，目前剩餘 {{remaining}} 次延伸機會。',
    'complete.maxReached': '已達延伸上限，目前的 DNA 分析已是最高精度。',

    // DNA
    'dna.title': 'Your Cine DNA',
    'dna.analyzing': '正在分析你的觀影 DNA...',
    'dna.retry': '重試',
    'dna.archetype': '原型',
    'dna.tags': '品味標籤',
    'dna.reading': 'AI 解讀',
    'dna.traits': '隱藏特質',
    'dna.style': '對話風格',
    'dna.idealDate': '理想的電影約會',
    'dna.share': '分享結果',
    'dna.findMatches': '尋找配對',

    // Matches
    'matches.title': 'Your Matches',
    'matches.discover': '尋找配對',
    'matches.discovering': '搜尋中...',
    'matches.empty': '目前沒有配對紀錄',
    'matches.emptyHint': '點擊「尋找配對」，系統會根據你的觀影 DNA 進行比對',
    'matches.invite': '發送邀請',
    'matches.accept': '接受',
    'matches.decline': '婉拒',
    'matches.matched': '已配對',

    // Theaters (Groups)
    'theaters.title': 'Theaters',
    'theaters.autoAssign': 'DNA 配組',
    'theaters.empty': '尚未加入任何放映廳',
    'theaters.emptyHint': '點擊「DNA 配組」，系統會根據你的觀影 DNA 自動分配',
    'theaters.join': '加入',
    'theaters.leave': '離開',
    'theaters.hidden': '隱藏',
    'theaters.active': '已啟用',
    'theaters.inactive': '未達門檻',

    // Profile
    'profile.title': '個人檔案',
    'profile.edit': '編輯',
    'profile.save': '儲存',
    'profile.cancel': '取消',
    'profile.name': '名稱',
    'profile.email': 'EMAIL',
    'profile.gender': '性別',
    'profile.birthYear': '出生年份',
    'profile.region': '地區',
    'profile.dnaStatus': 'DNA 狀態',
    'profile.matchPref': '配對偏好',
    'profile.lookingFor': '配對對象',
    'profile.ageRange': '年齡範圍',
    'profile.pureTaste': '純品味配對',
    'profile.yes': '是',
    'profile.no': '否',
    'profile.notSet': '未設定',
    'profile.loadError': '無法載入個人資料',
    'profile.seqStatus': '序列狀態',
    'profile.archetype': '原型',
    'profile.notStarted': '未開始',
    'profile.inProgress': '進行中',
    'profile.completed': '已完成',
    'profile.genderMale': '男性',
    'profile.genderFemale': '女性',
    'profile.genderOther': '其他',
    'profile.genderSkip': '不透露',
    'profile.prefAny': '不限',
    'profile.retest': '重新測試',
    'profile.retestHint': '開始新的序列分析，保留歷史紀錄。',
  },

  en: {
    // Common
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.back': 'Back',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',

    // Nav
    'nav.sequencing': 'Sequence',
    'nav.dna': 'DNA',
    'nav.matches': 'Matches',
    'nav.theaters': 'Theaters',
    'nav.profile': 'Profile',

    // Auth
    'auth.signIn': 'Sign in',
    'auth.signUp': 'Sign up',
    'auth.subtitle': 'Decode your cinematic DNA through movie choices',
    'auth.emailPlaceholder': 'Enter your email',
    'auth.sendLink': 'Send login link',
    'auth.sending': 'Sending...',
    'auth.verifying': 'Verifying...',
    'auth.verified': 'Verified',
    'auth.verifyFailed': 'Verification failed',
    'auth.invalidLink': 'Invalid or expired link',
    'auth.newLink': 'Request a new link',
    'auth.redirecting': 'Redirecting...',
    'auth.checkEmail': 'Check your inbox',
    'auth.checkEmailSent': 'We sent a login link to {{email}}',
    'auth.tryOther': 'Try a different email',
    'auth.invalidEmail': 'Please enter a valid email',
    'auth.noAccount': 'Don\'t have an account?',
    'auth.hasAccount': 'Already have an account?',
    'auth.backToLogin': 'Back to login',

    // Register
    'register.title': 'Create your account',
    'register.subtitle': 'Start your Cine Sequence',
    'register.name': 'Display name',
    'register.namePlaceholder': 'What should we call you',
    'register.nameRequired': 'Name is required',
    'register.gender': 'Gender',
    'register.genderMale': 'Male',
    'register.genderFemale': 'Female',
    'register.genderOther': 'Other',
    'register.genderSkip': 'Prefer not to say',
    'register.genderRequired': 'Please select a gender',
    'register.birthYear': 'Birth year',
    'register.submit': 'Sign up',

    // Preferences
    'pref.title': 'Match preferences',
    'pref.genderPref': 'Preferred gender',
    'pref.any': 'Any',
    'pref.ageRange': 'Age range',
    'pref.pureTaste': 'Taste-only matching',
    'pref.pureTasteHint': 'Ignore gender and age, match purely on taste',
    'pref.save': 'Save preferences',

    // Sequencing
    'seq.phase': 'Phase {{phase}}',
    'seq.round': 'Round {{round}} / {{total}}',
    'seq.skip': 'Skip',
    'seq.skipBoth': 'Haven\'t seen either',
    'seq.watched': 'Watched this one',
    'seq.attracted': 'Want to watch this one',

    // Sequencing - Seed
    'seed.title': 'Choose your starting point',
    'seed.subtitle': 'Pick a movie that represents your taste to calibrate the first few rounds.',
    'seed.placeholder': 'Search movie title...',
    'seed.confirm': 'Start sequencing',
    'seed.skip': 'Skip this step',
    'seed.searching': 'Searching...',

    // Sequencing - Complete
    'complete.title': 'Sequencing Complete',
    'complete.subtitle': '{{total}} rounds of sequence analysis completed. Your cinematic DNA is ready.',
    'complete.rounds': 'ROUNDS',
    'complete.extensions': 'EXTENSIONS',
    'complete.viewDna': 'View DNA result',
    'complete.extend': 'Extend analysis (+5 rounds)',
    'complete.extendHint': 'Add 5 rounds for higher precision. {{remaining}} extensions remaining.',
    'complete.maxReached': 'Maximum extensions reached. Your DNA analysis is at full precision.',

    // DNA
    'dna.title': 'Your Cine DNA',
    'dna.analyzing': 'Analyzing your cinematic DNA...',
    'dna.retry': 'Retry',
    'dna.archetype': 'Archetype',
    'dna.tags': 'Taste tags',
    'dna.reading': 'AI Reading',
    'dna.traits': 'Hidden traits',
    'dna.style': 'Conversation style',
    'dna.idealDate': 'Ideal movie date',
    'dna.share': 'Share result',
    'dna.findMatches': 'Find matches',

    // Matches
    'matches.title': 'Your Matches',
    'matches.discover': 'Find matches',
    'matches.discovering': 'Searching...',
    'matches.empty': 'No matches yet',
    'matches.emptyHint': 'Click "Find matches" to discover people with similar cinematic taste',
    'matches.invite': 'Send invite',
    'matches.accept': 'Accept',
    'matches.decline': 'Decline',
    'matches.matched': 'Matched',

    // Theaters (Groups)
    'theaters.title': 'Theaters',
    'theaters.autoAssign': 'DNA Assign',
    'theaters.empty': 'No theaters joined yet',
    'theaters.emptyHint': 'Click "DNA Assign" to auto-join theaters based on your cinematic DNA',
    'theaters.join': 'Join',
    'theaters.leave': 'Leave',
    'theaters.hidden': 'Hidden',
    'theaters.active': 'Active',
    'theaters.inactive': 'Not yet active',

    // Profile
    'profile.title': 'Profile',
    'profile.edit': 'Edit',
    'profile.save': 'Save',
    'profile.cancel': 'Cancel',
    'profile.name': 'NAME',
    'profile.email': 'EMAIL',
    'profile.gender': 'GENDER',
    'profile.birthYear': 'BIRTH YEAR',
    'profile.region': 'REGION',
    'profile.dnaStatus': 'DNA status',
    'profile.matchPref': 'MATCHING PREFERENCES',
    'profile.lookingFor': 'LOOKING FOR',
    'profile.ageRange': 'AGE RANGE',
    'profile.pureTaste': 'PURE TASTE MATCH',
    'profile.yes': 'Yes',
    'profile.no': 'No',
    'profile.notSet': 'Not set',
    'profile.loadError': 'Unable to load profile',
    'profile.seqStatus': 'SEQUENCING STATUS',
    'profile.archetype': 'ARCHETYPE',
    'profile.notStarted': 'Not started',
    'profile.inProgress': 'In progress',
    'profile.completed': 'Completed',
    'profile.genderMale': 'Male',
    'profile.genderFemale': 'Female',
    'profile.genderOther': 'Other',
    'profile.genderSkip': 'Not disclosed',
    'profile.prefAny': 'Any',
    'profile.retest': 'Retest',
    'profile.retestHint': 'Start a new sequence analysis. History is preserved.',
  },
}
