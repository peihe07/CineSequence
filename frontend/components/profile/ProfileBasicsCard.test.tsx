import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ''} />,
}))

import ProfileBasicsCard from './ProfileBasicsCard'

const profile = {
  id: '1',
  email: 'user@test.com',
  name: 'Test User',
  gender: 'other',
  region: 'TW',
  birth_year: 1995,
  bio: 'Quietly obsessed with endings and atmospheric cinema.',
  avatar_url: null,
  sequencing_status: 'completed',
  archetype_id: 'time-traveler',
  archetype_name: 'Time Traveler',
  personality_reading: 'A profile reading',
  ticket_style: 'classic',
  personal_ticket_url: null,
  match_gender_pref: 'any',
  match_age_min: 24,
  match_age_max: 36,
  pure_taste_match: true,
  is_admin: false,
} as const

describe('ProfileBasicsCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders identity and supporting facts in grouped sections', () => {
    render(
      <ProfileBasicsCard
        profile={profile}
        nameLabel="Name"
        bioLabel="Bio"
        bioPlaceholder="Add bio"
        addBioLabel="Add bio"
        emailLabel="Email"
        genderLabel="Gender"
        birthYearLabel="Birth Year"
        regionLabel="Region"
        saveLabel="Save"
        cancelLabel="Cancel"
        changeAvatarLabel="Change avatar"
        avatarHintLabel="Upload a portrait"
        avatarError={null}
        editNameLabel="Edit name"
        editBioLabel="Edit bio"
        editName={profile.name}
        editBio={profile.bio}
        isEditing={false}
        isEditingBio={false}
        saving={false}
        savingBio={false}
        uploadingAvatar={false}
        fileInputRef={{ current: null }}
        onAvatarUpload={vi.fn(async () => {})}
        onEditNameChange={vi.fn()}
        onEditBioChange={vi.fn()}
        onEditStart={vi.fn()}
        onEditCancel={vi.fn()}
        onSave={vi.fn(async () => {})}
        onBioEditStart={vi.fn()}
        onBioEditCancel={vi.fn()}
        onBioSave={vi.fn(async () => {})}
        getGenderLabel={() => 'Other'}
      />,
    )

    expect(screen.getByText('Test User')).toBeTruthy()
    expect(screen.getByText('user@test.com')).toBeTruthy()
    expect(screen.getByText('Quietly obsessed with endings and atmospheric cinema.')).toBeTruthy()
    expect(screen.getByText('Other')).toBeTruthy()
    expect(screen.getByText('1995')).toBeTruthy()
    expect(screen.getByText('TW')).toBeTruthy()
    expect(screen.getByText('Upload a portrait')).toBeTruthy()
  })
})
