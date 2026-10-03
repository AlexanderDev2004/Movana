import { ArrowRight, Bike, Briefcase } from 'lucide-react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import type { Role } from '~/lib/workspace'

export function RolePicker({ onPick }: { onPick: (role: Role) => void }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold">Mulai dari mana?</h2>
        <p className="text-sm text-muted-foreground">Pilih sekali. Bisa tambah workspace lain nanti.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bike className="size-5" aria-hidden />
              <Badge variant="secondary">Ojol</Badge>
            </div>
            <CardTitle className="text-lg">Ya, saya ojol</CardTitle>
            <CardDescription>Grab / Gojek / ShopeeFood / Maxim / sejenisnya</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => onPick('ojol')}>
              Pilih <ArrowRight aria-hidden />
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="size-5" aria-hidden />
              <Badge variant="secondary">Non-ojol</Badge>
            </div>
            <CardTitle className="text-lg">Bukan ojol</CardTitle>
            <CardDescription>Komuter / kurir pribadi / travel / motor harian</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => onPick('non-ojol')}>
              Pilih <ArrowRight aria-hidden />
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
