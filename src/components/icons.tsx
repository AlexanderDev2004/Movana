import type { IconType } from 'react-icons'
import {
  LuBike,
  LuBriefcase,
  LuCompass,
  LuEllipsis,
  LuLifeBuoy,
  LuPackage,
  LuRoute,
  LuSquareParking,
  LuUtensilsCrossed,
  LuWrench,
} from 'react-icons/lu'
import type { Workspace } from '~/lib/workspace'

/**
 * Satu-satunya sumber ikon Movana: react-icons, subset Lucide (`lu`) —
 * set yang sama dengan bawaan shadcn/ui, jadi gaya garisnya konsisten.
 * Jangan pakai emoji sebagai ikon.
 */

const EXPENSE_ICONS: Record<string, IconType> = {
  ban: LuLifeBuoy,
  makan: LuUtensilsCrossed,
  tol: LuRoute,
  parkir: LuSquareParking,
  service: LuWrench,
  lainnya: LuEllipsis,
}

/** Ikon kategori pengeluaran tambahan (fallback: Lainnya). */
export function ExpenseIcon({
  kategori,
  className,
}: {
  kategori: string
  className?: string
}) {
  const key = (kategori ?? '').trim().toLowerCase()
  const Cmp = EXPENSE_ICONS[key] ?? LuEllipsis
  return <Cmp className={className} aria-hidden />
}

/** Ikon peran workspace: ojol = motor, non-ojol = jenis kerja. */
export function WorkspaceIcon({
  ws,
  className,
}: {
  ws: Workspace | null | undefined
  className?: string
}) {
  let Cmp: IconType = LuBike
  if (ws?.role === 'non-ojol') {
    switch (ws.jobType) {
      case 'komuter':
        Cmp = LuBriefcase
        break
      case 'kurir':
        Cmp = LuPackage
        break
      case 'travel':
        Cmp = LuCompass
        break
      default:
        Cmp = LuBike
    }
  }
  return <Cmp className={className} aria-hidden />
}
