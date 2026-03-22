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

    // Onboarding
    'onboarding.title': '歡迎來到序列分析',
    'onboarding.step1': '每輪你會看到兩部電影，選擇更吸引你的那一部。',
    'onboarding.step2': '系統會從你的選擇中萃取觀影偏好，20 輪後生成你的 DNA。',
    'onboarding.step3': '不確定的話可以跳過，不會影響最終結果。',
    'onboarding.start': '開始',

    // Confirm dialogs
    'confirm.logout': '確定要登出嗎？',
    'confirm.leaveGroup': '確定要離開這個放映廳嗎？',

    // Landing
    'landing.start': '開始解碼',
    'landing.login': '登入',
    'landing.termLine1': '正在初始化 CINE SEQUENCE...',
    'landing.termLine2': '載入觀影偏好分析模組...',
    'landing.termLine3': '校準品味向量空間...',
    'landing.termLine4': '偵測到未知的觀影 DNA 序列。',
    'landing.termLine5': '是否開始解碼？',
    'landing.termHint': '按下 [Y] 或點擊開始',

    // Error boundary
    'error.title': '發生了一些問題',
    'error.description': '頁面遇到錯誤，請嘗試重新載入。',
    'error.retry': '重試',
    'error.backHome': '回到首頁',

    // Not found
    'notFound.title': '找不到頁面',
    'notFound.description': '你尋找的頁面不存在，或已被移除。',
    'notFound.backHome': '回到首頁',

    // Flow guard
    'guard.needSequencing': '請先完成序列分析',
    'guard.needDna': '請先生成你的觀影 DNA',

    // Toast
    'toast.inviteSent': '已發送邀請',
    'toast.inviteFailed': '邀請發送失敗',
    'toast.groupJoined': '已加入放映廳',
    'toast.groupLeft': '已離開放映廳',
    'toast.profileSaved': '個人資料已儲存',
    'toast.avatarUploaded': '頭像已更新',
    'toast.prefsSaved': '偏好設定已儲存',

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
    'matches.filterLabel': '配對偏好',
    'matches.prefGender': '對象性別',
    'matches.prefAny': '不限',
    'matches.prefFemale': '女性',
    'matches.prefMale': '男性',
    'matches.prefOther': '其他',
    'matches.prefAge': '年齡範圍',
    'matches.pureTaste': '純品味配對',
    'matches.pureTasteHint': '開啟後忽略性別與年齡，僅依品味相似度配對',
    'matches.invite': '發送邀請',
    'matches.accept': '接受',
    'matches.decline': '婉拒',
    'matches.matched': '已配對',
    'matches.tearHint': '向下拖曳撕開',
    'ticket.title': '配對票券',
    'ticket.similarity': '品味相似度',
    'ticket.sharedTags': '共同品味',
    'ticket.iceBreakers': '對話方向',
    'ticket.backToMatches': '返回配對列表',
    'ticket.notFound': '找不到這張票券',
    'ticket.notAccepted': '配對尚未確認',

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
    'profile.changeAvatar': '更換頭像',
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
    'profile.logout': '登出',
    'profile.loggingOut': '登出中...',

    // Register consent
    'register.agreePrefix': '我已閱讀並同意',
    'register.privacyLink': '隱私政策',
    'register.consentRequired': '請先同意隱私政策',

    // Privacy policy
    'privacy.title': '隱私政策',
    'privacy.lastUpdated': '最後更新：2026 年 3 月',
    'privacy.collectTitle': '我們蒐集的資料',
    'privacy.collectIntro': '為提供服務，我們蒐集以下資料：',
    'privacy.collectEmail': 'Email 地址（用於登入與通知）',
    'privacy.collectName': '顯示名稱',
    'privacy.collectGender': '性別（用於配對偏好篩選）',
    'privacy.collectRegion': '地區',
    'privacy.collectPicks': '觀影序列選擇紀錄（用於計算品味 DNA）',
    'privacy.sharedTitle': '配對時揭露的資訊',
    'privacy.sharedIntro': '當你與他人配對成功時，對方可以看到：',
    'privacy.sharedName': '你的顯示名稱',
    'privacy.sharedArchetype': '你的觀影原型',
    'privacy.sharedTags': '共同的品味標籤',
    'privacy.sharedIceBreakers': '由 AI 生成的對話方向',
    'privacy.sharedSimilarity': '品味相似度分數',
    'privacy.notSharedTitle': '不會揭露的資訊',
    'privacy.notSharedIntro': '以下資訊永遠不會透露給配對對象：',
    'privacy.notSharedEmail': 'Email 地址',
    'privacy.notSharedBirthYear': '出生年份',
    'privacy.notSharedGender': '性別',
    'privacy.storageTitle': '資料儲存',
    'privacy.storageBody': '你的資料儲存於加密的雲端資料庫，我們不會將個人資料出售給第三方。',
    'privacy.thirdPartyTitle': '第三方服務',
    'privacy.thirdPartyBody': '我們使用 TMDB 取得電影資訊、Google Gemini 生成 AI 分析。這些服務僅接收匿名化的品味數據，不包含你的個人識別資訊。',
    'privacy.rightsTitle': '你的權利',
    'privacy.rightsBody': '你可以隨時要求匯出或刪除你的帳號與所有相關資料。',
    'privacy.contactTitle': '聯繫我們',
    'privacy.contactBody': '如有隱私相關疑問，請透過應用程式內的設定頁面聯繫我們。',
  },

  en: {
    // Common
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.back': 'Back',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',

    // Onboarding
    'onboarding.title': 'Welcome to Sequencing',
    'onboarding.step1': 'Each round shows two films. Pick the one that draws you in more.',
    'onboarding.step2': 'The system extracts your viewing preferences across 20 rounds to generate your DNA.',
    'onboarding.step3': 'Not sure? Skip it. It won\'t affect your final result.',
    'onboarding.start': 'Begin',

    // Confirm dialogs
    'confirm.logout': 'Are you sure you want to sign out?',
    'confirm.leaveGroup': 'Are you sure you want to leave this theater?',

    // Landing
    'landing.start': 'Start Decoding',
    'landing.login': 'Sign in',
    'landing.termLine1': 'INITIALIZING CINE SEQUENCE...',
    'landing.termLine2': 'LOADING CINEMATIC PREFERENCE ANALYSIS MODULE...',
    'landing.termLine3': 'CALIBRATING TASTE VECTOR SPACE...',
    'landing.termLine4': 'UNKNOWN CINEMATIC DNA STRAND DETECTED.',
    'landing.termLine5': 'BEGIN SEQUENCING?',
    'landing.termHint': 'PRESS [Y] OR CLICK TO START',

    // Error boundary
    'error.title': 'Something went wrong',
    'error.description': 'The page encountered an error. Please try reloading.',
    'error.retry': 'Retry',
    'error.backHome': 'Back to home',

    // Not found
    'notFound.title': 'Page not found',
    'notFound.description': 'The page you are looking for does not exist or has been removed.',
    'notFound.backHome': 'Back to home',

    // Flow guard
    'guard.needSequencing': 'Please complete sequencing first',
    'guard.needDna': 'Please generate your cinematic DNA first',

    // Toast
    'toast.inviteSent': 'Invite sent',
    'toast.inviteFailed': 'Failed to send invite',
    'toast.groupJoined': 'Joined theater',
    'toast.groupLeft': 'Left theater',
    'toast.profileSaved': 'Profile saved',
    'toast.avatarUploaded': 'Avatar updated',
    'toast.prefsSaved': 'Preferences saved',

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
    'matches.filterLabel': 'Match Preferences',
    'matches.prefGender': 'Gender',
    'matches.prefAny': 'Any',
    'matches.prefFemale': 'Female',
    'matches.prefMale': 'Male',
    'matches.prefOther': 'Other',
    'matches.prefAge': 'Age Range',
    'matches.pureTaste': 'Pure taste match',
    'matches.pureTasteHint': 'Ignore gender and age, match by taste similarity only',
    'matches.invite': 'Send invite',
    'matches.accept': 'Accept',
    'matches.decline': 'Decline',
    'matches.matched': 'Matched',
    'matches.tearHint': 'Drag to tear open',
    'ticket.title': 'Match Ticket',
    'ticket.similarity': 'Taste Similarity',
    'ticket.sharedTags': 'Shared Tastes',
    'ticket.iceBreakers': 'Conversation Starters',
    'ticket.backToMatches': 'Back to Matches',
    'ticket.notFound': 'Ticket not found',
    'ticket.notAccepted': 'Match not yet confirmed',

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
    'profile.changeAvatar': 'Change avatar',
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
    'profile.logout': 'Log out',
    'profile.loggingOut': 'Logging out...',

    // Register consent
    'register.agreePrefix': 'I have read and agree to the',
    'register.privacyLink': 'Privacy Policy',
    'register.consentRequired': 'You must agree to the privacy policy',

    // Privacy policy
    'privacy.title': 'Privacy Policy',
    'privacy.lastUpdated': 'Last updated: March 2026',
    'privacy.collectTitle': 'Information We Collect',
    'privacy.collectIntro': 'To provide our service, we collect:',
    'privacy.collectEmail': 'Email address (for login and notifications)',
    'privacy.collectName': 'Display name',
    'privacy.collectGender': 'Gender (for match preference filtering)',
    'privacy.collectRegion': 'Region',
    'privacy.collectPicks': 'Sequencing choices (to compute your taste DNA)',
    'privacy.sharedTitle': 'Information Shared with Matches',
    'privacy.sharedIntro': 'When matched with someone, they can see:',
    'privacy.sharedName': 'Your display name',
    'privacy.sharedArchetype': 'Your cinematic archetype',
    'privacy.sharedTags': 'Shared taste tags',
    'privacy.sharedIceBreakers': 'AI-generated conversation starters',
    'privacy.sharedSimilarity': 'Taste similarity score',
    'privacy.notSharedTitle': 'Information Never Shared',
    'privacy.notSharedIntro': 'The following is never revealed to matches:',
    'privacy.notSharedEmail': 'Email address',
    'privacy.notSharedBirthYear': 'Birth year',
    'privacy.notSharedGender': 'Gender',
    'privacy.storageTitle': 'Data Storage',
    'privacy.storageBody': 'Your data is stored in encrypted cloud databases. We never sell personal data to third parties.',
    'privacy.thirdPartyTitle': 'Third-Party Services',
    'privacy.thirdPartyBody': 'We use TMDB for movie data and Google Gemini for AI analysis. These services only receive anonymized taste data, never your personal identifying information.',
    'privacy.rightsTitle': 'Your Rights',
    'privacy.rightsBody': 'You may request to export or delete your account and all associated data at any time.',
    'privacy.contactTitle': 'Contact Us',
    'privacy.contactBody': 'For privacy-related questions, please reach out through the settings page in the app.',
  },
}
