import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { uploadPhoto } from '@/lib/storage'
import { useAuthStore } from '@/store/auth'
import { useUpdateEntry } from '@/hooks/useFeed'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { StarRating } from '@/components/ui/StarRating'
import { PhotoDropzone } from '@/components/beer/PhotoDropzone'
import type { BeerStyle, BeerBrand, FeedEntry } from '@/types/database'

const schema = z.object({
  name: z.string().min(1, 'Beer name is required'),
  brewery: z.string().optional(),
  style_id: z.number().optional(),
  abv: z.number().min(0).max(100).optional(),
  rating: z.number().min(1).max(5),
  notes: z.string().optional(),
  tasted_at: z.string().min(1, 'Tasting date is required'),
})

type FormData = z.infer<typeof schema>

interface BeerEntryFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  editingEntry?: FeedEntry['entry'] | null
}

function toDateTimeLocalValue(isoString: string) {
  const date = new Date(isoString)
  const tzOffsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16)
}

function nowDateTimeLocalValue() {
  const now = new Date()
  const tzOffsetMs = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16)
}

export function BeerEntryForm({ onSuccess, onCancel, editingEntry }: BeerEntryFormProps) {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const updateEntry = useUpdateEntry()
  const isEditing = !!editingEntry

  const { data: styles } = useQuery<BeerStyle[]>({
    queryKey: ['beerStyles'],
    queryFn: async () => {
      const { data } = await supabase.from('beer_styles').select('*').order('name')
      return (data ?? []) as BeerStyle[]
    },
    staleTime: Infinity,
  })

  const { data: brands } = useQuery<Pick<BeerBrand, 'id' | 'name' | 'brewery' | 'style_id'>[]>({
    queryKey: ['beerBrands'],
    queryFn: async () => {
      const { data } = await supabase
        .from('beer_brands')
        .select('id, name, brewery, style_id')
        .order('name')
        .limit(500)
      return (data ?? []) as Pick<BeerBrand, 'id' | 'name' | 'brewery' | 'style_id'>[]
    },
    staleTime: 1000 * 60 * 10,
  })

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      rating: 3,
      tasted_at: nowDateTimeLocalValue(),
    },
  })

  useEffect(() => {
    if (editingEntry) {
      reset({
        name: editingEntry.name,
        brewery: editingEntry.brewery ?? '',
        style_id: editingEntry.style_id ?? undefined,
        abv: editingEntry.abv ?? undefined,
        rating: editingEntry.rating,
        notes: editingEntry.notes ?? '',
        tasted_at: toDateTimeLocalValue(editingEntry.tasted_at),
      })
      return
    }

    reset({
      name: '',
      brewery: '',
      style_id: undefined,
      abv: undefined,
      rating: 3,
      notes: '',
      tasted_at: nowDateTimeLocalValue(),
    })
  }, [editingEntry, reset])

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      const payload = {
        name: values.name,
        brewery: values.brewery ?? null,
        style_id: values.style_id ?? null,
        abv: values.abv ?? null,
        rating: values.rating,
        notes: values.notes ?? null,
        tasted_at: new Date(values.tasted_at).toISOString(),
      }

      if (editingEntry) {
        await updateEntry.mutateAsync({ id: editingEntry.id, values: payload })
        return { id: editingEntry.id }
      }

      const { data: entry, error } = await supabase
        .from('beer_entries')
        .insert({
          user_id: user!.id,
          ...payload,
        })
        .select('id')
        .single()

      if (error) throw error

      if (photoFile && entry && !editingEntry) {
        const storagePath = await uploadPhoto(photoFile, user!.id, entry.id)
        await supabase.from('photos').insert({
          beer_entry_id: entry.id,
          user_id: user!.id,
          storage_path: storagePath,
        })
      }

      return entry
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      if (!editingEntry) {
        reset({
          name: '',
          brewery: '',
          style_id: undefined,
          abv: undefined,
          rating: 3,
          notes: '',
          tasted_at: nowDateTimeLocalValue(),
        })
      }
      setPhotoFile(null)
      onSuccess?.()
    },
  })

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
      {/* Beer name with brands autocomplete */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-300">Beer name *</label>
        <input
          {...register('name')}
          list="brands-list"
          placeholder="e.g. Leffe Blonde"
          className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          onChange={(e) => {
            register('name').onChange(e)
            const match = brands?.find((b) => b.name === e.target.value)
            if (match) {
              setValue('brewery', match.brewery ?? '')
              if (match.style_id) setValue('style_id', match.style_id)
            }
          }}
        />
        <datalist id="brands-list">
          {brands?.map((b) => (
            <option key={b.id} value={b.name}>
              {b.brewery}
            </option>
          ))}
        </datalist>
        {errors.name && <span className="text-xs text-red-400">{errors.name.message}</span>}
      </div>

      <Input label="Brewery" {...register('brewery')} placeholder="e.g. Brasserie Leffe" />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-300">Style</label>
          <select
            onChange={(e) => setValue('style_id', e.target.value ? Number(e.target.value) : undefined)}
            className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">Select style…</option>
            {styles?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-300">ABV (%)</label>
          <input
            type="number"
            step="0.1"
            placeholder="5.0"
            onChange={(e) => setValue('abv', e.target.value ? Number(e.target.value) : undefined)}
            className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-300">Rating *</label>
        <Controller
          name="rating"
          control={control}
          render={({ field }) => <StarRating value={field.value} onChange={field.onChange} />}
        />
        {errors.rating && <span className="text-xs text-red-400">{errors.rating.message}</span>}
      </div>

      <Textarea label="Notes" {...register('notes')} placeholder="What did you think?" rows={3} />

      <Input
        label="Date tasted *"
        type="datetime-local"
        {...register('tasted_at')}
        error={errors.tasted_at?.message}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-300">Photo</label>
        <PhotoDropzone onFile={setPhotoFile} />
      </div>

      {mutation.error && (
        <p className="text-sm text-red-400">{(mutation.error as Error).message}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" loading={mutation.isPending || updateEntry.isPending} size="lg" className="flex-1">
          {isEditing ? 'Save changes' : '🍺 Log this beer'}
        </Button>
        {isEditing && (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
