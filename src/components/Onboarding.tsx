import * as React from 'react'
import { ArrowLeft } from 'lucide-react'
import type { NonOjolJob, Role } from '~/lib/workspace'
import {
  JOB_DESC,
  JOB_LABEL,
  PLATFORM_LABEL,
  PLATFORM_LIST,
  defaultWorkspaceName,
} from '~/lib/workspace'
import type { Platform } from '~/lib/calc'
import { RolePicker } from '~/components/home/RolePicker'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

export interface OnboardingResult {
  role: Role
  platforms: Platform[]
  jobType: NonOjolJob
  name: string
}

const JOBS: NonOjolJob[] = ['komuter', 'kurir', 'travel', 'pribadi']

export function Onboarding({
  onDone,
  onCancel,
  title = 'Halo! Kamu ojol atau bukan?',
  initialRole,
}: {
  onDone: (r: OnboardingResult) => void
  onCancel?: () => void
  title?: string
  initialRole?: Role | null
}) {
  const [step, setStep] = React.useState<1 | 2 | 3>(initialRole ? 2 : 1)
  const [role, setRole] = React.useState<Role | null>(initialRole ?? null)

  React.useEffect(() => {
    if (initialRole) {
      setRole(initialRole)
      setStep(2)
    }
  }, [initialRole])
  const [platforms, setPlatforms] = React.useState<Platform[]>(['grab'])
  const [job, setJob] = React.useState<NonOjolJob>('komuter')
  const [name, setName] = React.useState('')

  const pickRole = (r: Role) => {
    setRole(r)
    setStep(2)
  }

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  const canNextStep2 = role === 'ojol' ? platforms.length > 0 : true

  const finish = () => {
    if (!role) return
    onDone({
      role,
      platforms: role === 'ojol' ? platforms : [],
      jobType: job,
      name: name.trim() || defaultWorkspaceName(role, platforms, job),
    })
  }

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-1">
        <StepDots step={step} />
        <h1 className="text-xl font-bold tracking-tight">
          {step === 1 ? title : step === 2 ? (role === 'ojol' ? 'Pakai aplikasi apa?' : 'Buat apa?') : 'Kasih nama'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {step === 1 && 'Pilih sekali — nanti tersimpan.'}
          {step === 2 && role === 'ojol' && 'Bisa pilih lebih dari 1. Lebih dari 1 = mode multi.'}
          {step === 2 && role !== 'ojol' && 'Biar hitungan menyesuaikan (ada yang tanpa pendapatan).'}
          {step === 3 && 'Satu workspace = satu mode. Misal “Ojol Grab” dan “Komuter” terpisah.'}
        </p>
      </div>

      {step === 1 && <RolePicker onPick={pickRole} />}

      {step === 2 && role === 'ojol' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {PLATFORM_LIST.map((p) => {
              const on = platforms.includes(p)
              return (
                <Button
                  key={p}
                  variant={on ? 'default' : 'outline'}
                  className="h-auto justify-start py-3"
                  onClick={() => togglePlatform(p)}
                  aria-pressed={on}
                >
                  {PLATFORM_LABEL[p]}
                </Button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {platforms.length <= 1
              ? 'Mode single: satu angka kotor per hari.'
              : `Mode multi (${platforms.length} aplikasi): catat per platform.`}
          </p>
        </div>
      )}

      {step === 2 && role === 'non-ojol' && (
        <div className="grid gap-2">
          {JOBS.map((j) => (
            <Button
              key={j}
              variant={job === j ? 'default' : 'outline'}
              className="h-auto flex-col items-start gap-0.5 p-3"
              onClick={() => setJob(j)}
              aria-pressed={job === j}
            >
              <span className="font-bold text-sm">{JOB_LABEL[j]}</span>
              <span className="text-xs font-normal opacity-70">{JOB_DESC[j]}</span>
            </Button>
          ))}
        </div>
      )}

      {step === 3 && role && (
        <div className="space-y-3">
          <Card className="py-3 bg-muted border-0 shadow-none">
            <CardContent>
              <p className="text-sm">
                {role === 'ojol' ? (
                  <>
                    Ojol — {platforms.map((p) => PLATFORM_LABEL[p]).join(' + ') || '—'} (
                    {platforms.length > 1 ? 'multi' : 'single'})
                  </>
                ) : (
                  <>
                    {JOB_LABEL[job]} — {JOB_DESC[job]}
                  </>
                )}
              </p>
            </CardContent>
          </Card>
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-ws-name">Nama workspace</Label>
            <Input
              id="onboarding-ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultWorkspaceName(role, platforms, job)}
              className="h-12 text-base"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 items-center pt-1">
        {step > 1 && (
          <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
            <ArrowLeft aria-hidden /> Kembali
          </Button>
        )}
        {step === 2 && (
          <Button disabled={!canNextStep2} onClick={() => setStep(3)} className="flex-1">
            Lanjut
          </Button>
        )}
        {step === 3 && (
          <Button onClick={finish} className="flex-1">
            Buat workspace
          </Button>
        )}
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} className="ml-auto">
            Batal
          </Button>
        )}
      </div>
    </div>
  )
}

function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Langkah ${step} dari 3`}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-1.5 rounded-full transition-colors ${
            n <= step ? 'w-6 bg-primary' : 'w-3 bg-muted'
          }`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1 tabular-nums">{step}/3</span>
    </div>
  )
}
