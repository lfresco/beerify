import { useEffect, useMemo, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { apiRequest } from '@/lib/api'
import { compressPhotoForUpload, uploadPhoto } from '@/lib/storage'
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
  location_type: z.enum(['bar', 'home', 'city']).nullable().optional(),
  place_provider: z.string().nullable().optional(),
  place_id: z.string().nullable().optional(),
  place_name: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  place_key: z.string().nullable().optional(),
  tasted_at: z.string().min(1, 'Tasting date is required'),
})

type FormData = z.infer<typeof schema>

interface BeerEntryFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  editingEntry?: FeedEntry['entry'] | null
  initialTaggedUserIds?: string[]
}

interface FriendRequestsResponse {
  incoming: Array<{
    id: string
    requester_id: string
    recipient_id: string
    status: 'pending' | 'accepted' | 'rejected'
    profiles: { id: string; username: string; display_name: string | null } | null
  }>
  outgoing: Array<{
    id: string
    requester_id: string
    recipient_id: string
    status: 'pending' | 'accepted' | 'rejected'
    profiles: { id: string; username: string; display_name: string | null } | null
  }>
}

interface PlaceOption {
  provider: 'nominatim'
  placeId: string
  placeName: string
  city: string | null
  latitude: number
  longitude: number
}

interface NominatimSearchResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
  }
}

interface NominatimReverseResult {
  lat: string
  lon: string
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
  }
}

type LocationMode = 'none' | 'bar' | 'home' | 'city'

function cityFromAddress(address?: {
  city?: string
  town?: string
  village?: string
  municipality?: string
  county?: string
}) {
  return address?.city ?? address?.town ?? address?.village ?? address?.municipality ?? address?.county ?? null
}

function normalizePlaceKey(placeName: string | null, city: string | null) {
  const normalizedPlace = (placeName ?? '').trim().toLowerCase().replace(/\s+/g, '-')
  const normalizedCity = (city ?? '').trim().toLowerCase().replace(/\s+/g, '-')
  if (!normalizedPlace && !normalizedCity) return null
  return `${normalizedPlace || 'unknown'}::${normalizedCity || 'unknown'}`
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

export function BeerEntryForm({ onSuccess, onCancel, editingEntry, initialTaggedUserIds = [] }: BeerEntryFormProps) {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [friendSearch, setFriendSearch] = useState('')
  const [locationMode, setLocationMode] = useState<LocationMode>('none')
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<PlaceOption[]>([])
  const [selectedPlace, setSelectedPlace] = useState<PlaceOption | null>(null)
  const [cityInput, setCityInput] = useState('')
  const [geoCoords, setGeoCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
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

  const { data: taggableFriends } = useQuery<
    Array<{ id: string; username: string; display_name: string | null }>
  >({
    queryKey: ['taggable-friends', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error('Your session expired. Please sign in again.')
      }

      const response = await apiRequest<FriendRequestsResponse>(
        '/friends/requests',
        {},
        sessionData.session.access_token,
      )

      const byId = new Map<string, { id: string; username: string; display_name: string | null }>()

      for (const request of response.incoming ?? []) {
        if (request.status !== 'accepted' || !request.profiles) continue
        byId.set(request.profiles.id, {
          id: request.profiles.id,
          username: request.profiles.username,
          display_name: request.profiles.display_name,
        })
      }

      for (const request of response.outgoing ?? []) {
        if (request.status !== 'accepted' || !request.profiles) continue
        byId.set(request.profiles.id, {
          id: request.profiles.id,
          username: request.profiles.username,
          display_name: request.profiles.display_name,
        })
      }

      return Array.from(byId.values())
    },
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
      setSelectedFriendIds(initialTaggedUserIds)

      if (editingEntry.location_type) {
        setLocationMode(editingEntry.location_type)
        setCityInput(editingEntry.city ?? '')
        setGeoCoords(
          editingEntry.latitude != null && editingEntry.longitude != null
            ? { latitude: editingEntry.latitude, longitude: editingEntry.longitude }
            : null,
        )

        if (editingEntry.location_type === 'bar') {
          setSelectedPlace(
            editingEntry.place_name
              ? {
                  provider: (editingEntry.place_provider as 'nominatim' | null) ?? 'nominatim',
                  placeId: editingEntry.place_id ?? editingEntry.place_key ?? editingEntry.place_name,
                  placeName: editingEntry.place_name,
                  city: editingEntry.city,
                  latitude: editingEntry.latitude ?? 0,
                  longitude: editingEntry.longitude ?? 0,
                }
              : null,
          )
          setPlaceQuery(editingEntry.place_name ?? '')
        } else {
          setSelectedPlace(null)
          setPlaceQuery('')
        }
      } else {
        setLocationMode('none')
        setSelectedPlace(null)
        setPlaceQuery('')
        setCityInput('')
        setGeoCoords(null)
      }

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
    setSelectedFriendIds([])
    setLocationMode('none')
    setSelectedPlace(null)
    setPlaceQuery('')
    setPlaceResults([])
    setCityInput('')
    setGeoCoords(null)
    setLocationError(null)
  }, [editingEntry, initialTaggedUserIds, reset])

  function toggleTag(userId: string) {
    setSelectedFriendIds((prev) => (
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    ))
  }

  async function useCurrentCity() {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.')
      return
    }

    setLocationLoading(true)
    setLocationError(null)

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10_000,
        })
      })

      const latitude = position.coords.latitude
      const longitude = position.coords.longitude
      setGeoCoords({ latitude, longitude })

      const reverseUrl = new URL('https://nominatim.openstreetmap.org/reverse')
      reverseUrl.searchParams.set('format', 'jsonv2')
      reverseUrl.searchParams.set('lat', String(latitude))
      reverseUrl.searchParams.set('lon', String(longitude))
      reverseUrl.searchParams.set('addressdetails', '1')

      const reverseResponse = await fetch(reverseUrl.toString())
      if (!reverseResponse.ok) throw new Error('Reverse geocoding failed')

      const reverseData = (await reverseResponse.json()) as NominatimReverseResult
      const detectedCity = cityFromAddress(reverseData.address)
      if (detectedCity) {
        setCityInput(detectedCity)
      } else {
        setLocationError('Could not detect a city from your current location.')
      }
    } catch {
      setLocationError('Unable to access your location. You can enter city manually.')
    } finally {
      setLocationLoading(false)
    }
  }

  useEffect(() => {
    if (locationMode !== 'bar') {
      setPlaceResults([])
      setLocationError(null)
      return
    }

    const query = placeQuery.trim()
    if (query.length < 3) {
      setPlaceResults([])
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        setLocationLoading(true)
        const url = new URL('https://nominatim.openstreetmap.org/search')
        url.searchParams.set('format', 'jsonv2')
        url.searchParams.set('q', query)
        url.searchParams.set('addressdetails', '1')
        url.searchParams.set('limit', '6')

        const response = await fetch(url.toString(), { signal: controller.signal })
        if (!response.ok) throw new Error('Place lookup failed')

        const data = (await response.json()) as NominatimSearchResult[]
        const mapped: PlaceOption[] = data.map((item) => ({
          provider: 'nominatim',
          placeId: String(item.place_id),
          placeName: item.display_name,
          city: cityFromAddress(item.address),
          latitude: Number(item.lat),
          longitude: Number(item.lon),
        }))

        setPlaceResults(mapped)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setLocationError('Could not load places right now. Try again in a moment.')
        }
      } finally {
        setLocationLoading(false)
      }
    }, 350)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [locationMode, placeQuery])

  const filteredTaggableFriends = useMemo(() => {
    const all = taggableFriends ?? []
    const q = friendSearch.trim().toLowerCase()
    if (!q) return all
    return all.filter((friend) => {
      const name = (friend.display_name ?? '').toLowerCase()
      const username = friend.username.toLowerCase()
      return name.includes(q) || username.includes(q)
    })
  }, [friendSearch, taggableFriends])

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      const normalizedCity = cityInput.trim() || null

      const locationPayload = (() => {
        if (locationMode === 'bar' && selectedPlace) {
          const derivedCity = selectedPlace.city ?? normalizedCity
          return {
            location_type: 'bar' as const,
            place_provider: selectedPlace.provider,
            place_id: selectedPlace.placeId,
            place_name: selectedPlace.placeName,
            city: derivedCity,
            latitude: Number.isFinite(selectedPlace.latitude) ? selectedPlace.latitude : null,
            longitude: Number.isFinite(selectedPlace.longitude) ? selectedPlace.longitude : null,
            place_key: normalizePlaceKey(selectedPlace.placeName, derivedCity),
          }
        }

        if (locationMode === 'home' || locationMode === 'city') {
          return {
            location_type: locationMode,
            place_provider: null,
            place_id: null,
            place_name: locationMode === 'home' ? 'Home' : null,
            city: normalizedCity,
            latitude: geoCoords?.latitude ?? null,
            longitude: geoCoords?.longitude ?? null,
            place_key: normalizePlaceKey(locationMode === 'home' ? 'Home' : null, normalizedCity),
          }
        }

        return {
          location_type: null,
          place_provider: null,
          place_id: null,
          place_name: null,
          city: null,
          latitude: null,
          longitude: null,
          place_key: null,
        }
      })()

      const payload = {
        name: values.name,
        brewery: values.brewery ?? null,
        style_id: values.style_id ?? null,
        abv: values.abv ?? null,
        rating: values.rating,
        notes: values.notes ?? null,
        ...locationPayload,
        tasted_at: new Date(values.tasted_at).toISOString(),
      }

      if (editingEntry) {
        await updateEntry.mutateAsync({ id: editingEntry.id, values: payload })

        await supabase
          .from('beer_entry_tags')
          .delete()
          .eq('beer_entry_id', editingEntry.id)
          .eq('tagged_by_id', user!.id)

        if (selectedFriendIds.length > 0) {
          const { error: tagsError } = await supabase
            .from('beer_entry_tags')
            .insert(
              selectedFriendIds.map((friendId) => ({
                beer_entry_id: editingEntry.id,
                tagged_user_id: friendId,
                tagged_by_id: user!.id,
              })),
            )
          if (tagsError) throw tagsError
        }

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
        const optimizedPhoto = await compressPhotoForUpload(photoFile)
        const storagePath = await uploadPhoto(optimizedPhoto, user!.id, entry.id)
        await supabase.from('photos').insert({
          beer_entry_id: entry.id,
          user_id: user!.id,
          storage_path: storagePath,
        })
      }

      if (entry && selectedFriendIds.length > 0) {
        const { error: tagsError } = await supabase
          .from('beer_entry_tags')
          .insert(
            selectedFriendIds.map((friendId) => ({
              beer_entry_id: entry.id,
              tagged_user_id: friendId,
              tagged_by_id: user!.id,
            })),
          )
        if (tagsError) throw tagsError
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
        setSelectedFriendIds([])
        setLocationMode('none')
        setPlaceQuery('')
        setPlaceResults([])
        setSelectedPlace(null)
        setCityInput('')
        setGeoCoords(null)
        setLocationError(null)
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

      <div className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-800/40 p-3">
        <label className="text-sm font-medium text-slate-300">Where are you drinking? (optional)</label>

        <div className="flex flex-wrap gap-2">
          {([
            { id: 'none', label: 'No location' },
            { id: 'bar', label: 'Bar / Restaurant' },
            { id: 'home', label: 'Home' },
            { id: 'city', label: 'City only' },
          ] as Array<{ id: LocationMode; label: string }>).map((mode) => {
            const selected = locationMode === mode.id
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  setLocationMode(mode.id)
                  setLocationError(null)
                }}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selected
                  ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                  : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'}`}
              >
                {mode.label}
              </button>
            )
          })}
        </div>

        {locationMode === 'bar' && (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Search bar, pub, restaurant..."
              value={placeQuery}
              onChange={(e) => {
                setPlaceQuery(e.target.value)
                setSelectedPlace(null)
                setLocationError(null)
              }}
              className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />

            {locationLoading && <p className="text-xs text-slate-500">Searching places...</p>}

            {!locationLoading && placeQuery.trim().length >= 3 && placeResults.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/60">
                {placeResults.map((place) => (
                  <button
                    key={`${place.provider}:${place.placeId}`}
                    type="button"
                    onClick={() => {
                      setSelectedPlace(place)
                      setPlaceQuery(place.placeName)
                      setCityInput(place.city ?? '')
                      setGeoCoords({ latitude: place.latitude, longitude: place.longitude })
                      setPlaceResults([])
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/60 border-b border-slate-800 last:border-b-0"
                  >
                    {place.placeName}
                  </button>
                ))}
              </div>
            )}

            {!locationLoading && placeQuery.trim().length >= 3 && placeResults.length === 0 && !selectedPlace && (
              <p className="text-xs text-slate-500">No places found. Try a broader query.</p>
            )}

            {selectedPlace && (
              <p className="text-xs text-emerald-300">
                Selected: {selectedPlace.placeName}
              </p>
            )}
          </div>
        )}

        {(locationMode === 'home' || locationMode === 'city') && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="City"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <Button type="button" size="sm" variant="ghost" onClick={() => void useCurrentCity()} loading={locationLoading}>
                Use my location
              </Button>
            </div>
            <p className="text-xs text-slate-500">You can fill city manually if geolocation is unavailable.</p>
          </div>
        )}

        {locationError && <p className="text-xs text-red-400">{locationError}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">Drinking with (optional)</label>
        <p className="text-xs text-slate-500">You can post without tagging anyone.</p>
        {!taggableFriends || taggableFriends.length === 0 ? (
          <p className="text-xs text-slate-500">No taggable friends yet. Add friends first.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Search friends..."
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {filteredTaggableFriends.length === 0 ? (
              <p className="text-xs text-slate-500">No friends match your search.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredTaggableFriends.map((friend) => {
                  const selected = selectedFriendIds.includes(friend.id)
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => toggleTag(friend.id)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selected
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'}`}
                    >
                      {friend.display_name ?? friend.username}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

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
