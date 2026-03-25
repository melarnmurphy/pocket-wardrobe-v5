"use client";

import Link from "next/link";
import {
  type ReactNode,
  useActionState,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useState
} from "react";
import { useFormStatus } from "react-dom";
import { GarmentImageUpload } from "@/components/garment-image-upload";
import {
  wardrobeActionState,
  type WardrobeActionState
} from "@/lib/domain/wardrobe/action-state";
import { canonicalWardrobeColours } from "@/lib/domain/wardrobe/colours";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";

const seasonOptions = ["spring", "summer", "autumn", "winter"] as const;

export function WardrobeShop({
  garments,
  createGarmentAction,
  addGarmentImageAction,
  deleteGarmentAction,
  toggleGarmentFavouriteAction,
  logWearAction,
  updateGarmentAction
}: {
  garments: GarmentListItem[];
  createGarmentAction: (
    state: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
  addGarmentImageAction: (
    state: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
  deleteGarmentAction: (
    state: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
  toggleGarmentFavouriteAction: (
    state: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
  logWearAction: (
    state: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
  updateGarmentAction: (
    state: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
}) {
  const [activeGarmentId, setActiveGarmentId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createMobileStep, setCreateMobileStep] = useState<1 | 2>(1);
  const [isCreateDetailsOpen, setIsCreateDetailsOpen] = useState(false);
  const [isFilterBarCondensed, setIsFilterBarCondensed] = useState(false);
  const [createPreviewTitle, setCreatePreviewTitle] = useState("");
  const [createPreviewBrand, setCreatePreviewBrand] = useState("");
  const [createPreviewCategory, setCreatePreviewCategory] = useState("");
  const [createPreviewSubcategory, setCreatePreviewSubcategory] = useState("");
  const [createPreviewColour, setCreatePreviewColour] = useState("");
  const [createPreviewPrice, setCreatePreviewPrice] = useState("");
  const [createPreviewCurrency, setCreatePreviewCurrency] = useState("AUD");
  const [createPreviewImageUrl, setCreatePreviewImageUrl] = useState<string | null>(null);
  const [createSuccessToast, setCreateSuccessToast] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [occasionFilter, setOccasionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [colourFilter, setColourFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const deferredQuery = useDeferredValue(query);
  const [createState, createFormAction] = useActionState(
    createGarmentAction,
    wardrobeActionState
  );

  const categories = useMemo(
    () =>
      Array.from(new Set(garments.map((garment) => garment.category).filter(Boolean))).sort(),
    [garments]
  );
  const occasions = useMemo(
    () =>
      Array.from(
        new Set(garments.map((garment) => garment.formality_level).filter(Boolean))
      ).sort(),
    [garments]
  );
  const statuses = useMemo(
    () =>
      Array.from(new Set(garments.map((garment) => garment.wardrobe_status))).sort(),
    [garments]
  );
  const activeFilterChips = useMemo(
    () =>
      [
        query.trim()
          ? {
              key: "query",
              label: `Search: ${query.trim()}`,
              onClear: () => setQuery("")
            }
          : null,
        occasionFilter !== "all"
          ? {
              key: "occasion",
              label: `Occasion: ${occasionLabel(occasionFilter)}`,
              onClear: () => setOccasionFilter("all")
            }
          : null,
        typeFilter !== "all"
          ? {
              key: "type",
              label: `Type: ${categoryLabel(typeFilter)}`,
              onClear: () => setTypeFilter("all")
            }
          : null,
        seasonFilter !== "all"
          ? {
              key: "season",
              label: `Season: ${categoryLabel(seasonFilter)}`,
              onClear: () => setSeasonFilter("all")
            }
          : null,
        colourFilter !== "all"
          ? {
              key: "colour",
              label: `Colour: ${categoryLabel(colourFilter)}`,
              onClear: () => setColourFilter("all")
            }
          : null,
        statusFilter !== "all"
          ? {
              key: "status",
              label: `Status: ${categoryLabel(statusFilter)}`,
              onClear: () => setStatusFilter("all")
            }
          : null,
        favouritesOnly
          ? {
              key: "favourites",
              label: "Favourites only",
              onClear: () => setFavouritesOnly(false)
            }
          : null,
        sortBy !== "newest"
          ? {
              key: "sort",
              label: `Sort: ${sortLabel(sortBy)}`,
              onClear: () => setSortBy("newest")
            }
          : null
      ].filter((chip): chip is { key: string; label: string; onClear: () => void } => Boolean(chip)),
    [colourFilter, favouritesOnly, occasionFilter, query, seasonFilter, sortBy, statusFilter, typeFilter]
  );

  const filteredGarments = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return garments
      .filter((garment) => {
        if (normalizedQuery) {
          const haystack = [
            garment.title,
            garment.brand,
            garment.category,
            garment.subcategory,
            garment.material,
            garment.formality_level
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (!haystack.includes(normalizedQuery)) {
            return false;
          }
        }

        if (occasionFilter !== "all" && garment.formality_level !== occasionFilter) {
          return false;
        }

        if (typeFilter !== "all" && garment.category !== typeFilter) {
          return false;
        }

        if (seasonFilter !== "all" && !garment.seasonality.includes(seasonFilter)) {
          return false;
        }

        if (colourFilter !== "all" && garment.primary_colour_family !== colourFilter) {
          return false;
        }

        if (statusFilter !== "all" && garment.wardrobe_status !== statusFilter) {
          return false;
        }

        if (favouritesOnly && !(garment.favourite_score && garment.favourite_score > 0)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        switch (sortBy) {
          case "cost_desc":
            return (right.cost_per_wear ?? -1) - (left.cost_per_wear ?? -1);
          case "cost_asc":
            return (left.cost_per_wear ?? Number.MAX_SAFE_INTEGER) - (right.cost_per_wear ?? Number.MAX_SAFE_INTEGER);
          case "favourites":
            return (right.favourite_score ?? 0) - (left.favourite_score ?? 0);
          case "most_worn":
            return right.wear_count - left.wear_count;
          case "price_desc":
            return (right.purchase_price ?? -1) - (left.purchase_price ?? -1);
          default:
            return (
              new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
            );
        }
      });
  }, [
    deferredQuery,
    favouritesOnly,
    garments,
    occasionFilter,
    colourFilter,
    seasonFilter,
    sortBy,
    statusFilter,
    typeFilter
  ]);

  const activeGarment = useMemo(
    () => garments.find((garment) => garment.id === activeGarmentId) ?? null,
    [activeGarmentId, garments]
  );

  useEffect(() => {
    if (
      (createState.status === "success" || createState.status === "partial") &&
      createState.garmentId
    ) {
      const createdLabel = createPreviewTitle.trim() || createPreviewCategory.trim() || "New item";
      setIsCreateOpen(false);
      setCreateMobileStep(1);
      setIsCreateDetailsOpen(false);
      setCreateSuccessToast(`${createdLabel} added to your shop`);
      setCreatePreviewTitle("");
      setCreatePreviewBrand("");
      setCreatePreviewCategory("");
      setCreatePreviewSubcategory("");
      setCreatePreviewColour("");
      setCreatePreviewPrice("");
      setCreatePreviewCurrency("AUD");
      setCreatePreviewImageUrl(null);
      setActiveGarmentId(createState.garmentId);
    }
  }, [
    createPreviewCategory,
    createPreviewTitle,
    createState.garmentId,
    createState.status
  ]);

  useEffect(() => {
    if (!createSuccessToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCreateSuccessToast(null);
    }, 2800);

    return () => window.clearTimeout(timeoutId);
  }, [createSuccessToast]);

  useEffect(() => {
    if (activeGarmentId && !garments.some((garment) => garment.id === activeGarmentId)) {
      setActiveGarmentId(null);
    }
  }, [activeGarmentId, garments]);

  useEffect(() => {
    const updateCondensedState = () => {
      setIsFilterBarCondensed(window.scrollY > 120);
    };

    updateCondensedState();
    window.addEventListener("scroll", updateCondensedState, { passive: true });

    return () => window.removeEventListener("scroll", updateCondensedState);
  }, []);

  const openCreateComposer = () => {
    setIsCreateOpen(true);
    setCreateMobileStep(1);
    setIsCreateDetailsOpen(false);
    setCreatePreviewTitle("");
    setCreatePreviewBrand("");
    setCreatePreviewCategory("");
    setCreatePreviewSubcategory("");
    setCreatePreviewColour("");
    setCreatePreviewPrice("");
    setCreatePreviewCurrency("AUD");
    setCreatePreviewImageUrl(null);
  };

  return (
    <>
      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.34em] text-[var(--muted)]">
              Wardrobe
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
              <span>{garments.length} items</span>
              <span className="text-[rgba(23,20,17,0.22)]">/</span>
              <span>
                {garments.filter((garment) => garment.favourite_score && garment.favourite_score > 0)
                  .length} favourites
              </span>
              <span className="text-[rgba(23,20,17,0.22)]">/</span>
              <span>{garments.reduce((total, garment) => total + garment.wear_count, 0)} wears tracked</span>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreateComposer}
            className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-foreground)] shadow-[0_12px_25px_rgba(166,99,60,0.22)] transition-transform hover:-translate-y-0.5"
          >
            <PlusIcon />
            Add Item
          </button>
        </div>

        <div
          className={`sticky top-4 z-20 rounded-[1.75rem] border border-[rgba(23,20,17,0.08)] bg-[rgba(255,251,246,0.88)] shadow-[0_18px_40px_rgba(40,25,12,0.08)] backdrop-blur-xl transition-all duration-300 ${
            isFilterBarCondensed ? "p-3 shadow-[0_16px_32px_rgba(40,25,12,0.1)]" : "p-4"
          }`}
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                Refine View
              </p>
              {!isFilterBarCondensed ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Search by brand or garment, then narrow by occasion, season, status, or sort
                  order.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(23,20,17,0.04)] px-3 py-2">
                <GridIcon />
                {filteredGarments.length} visible
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(23,20,17,0.04)] px-3 py-2">
                <StarIcon filled />
                {garments.filter((garment) => garment.favourite_score && garment.favourite_score > 0).length} favourites
              </span>
              <span className="hidden items-center gap-2 rounded-full bg-[rgba(23,20,17,0.04)] px-3 py-2 sm:inline-flex">
                <WearIcon />
                {garments.reduce((total, garment) => total + garment.wear_count, 0)} wears
              </span>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setOccasionFilter("all");
                  setTypeFilter("all");
                  setSeasonFilter("all");
                  setColourFilter("all");
                  setStatusFilter("all");
                  setFavouritesOnly(false);
                  setSortBy("newest");
                }}
                className="rounded-full border border-[var(--line)] px-3 py-2 font-medium transition-colors hover:bg-white"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={openCreateComposer}
                className="rounded-full bg-[var(--foreground)] px-3 py-2 font-medium text-white transition-colors hover:bg-[rgba(23,20,17,0.88)]"
              >
                Add Item
              </button>
            </div>
          </div>

          <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-3 xl:grid xl:min-w-0 xl:flex-none xl:grid-cols-[1.15fr_repeat(6,minmax(0,1fr))]">
            <label className="flex min-w-[18rem] items-center gap-3 rounded-[1.1rem] border border-[rgba(23,20,17,0.08)] bg-[linear-gradient(180deg,#fff,#fbf7f1)] px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] xl:min-w-0">
              <SearchIcon />
              <input
                suppressHydrationWarning
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent outline-none placeholder:text-[var(--muted)]"
                placeholder="Search brand, type, occasion"
              />
            </label>

            <FilterSelect
              icon={<OccasionIcon />}
              label="Occasion"
              value={occasionFilter}
              onChange={setOccasionFilter}
              options={[
                { value: "all", label: "All occasions" },
                ...occasions.map((occasion) => ({
                  value: occasion as string,
                  label: occasionLabel(occasion as string)
                }))
              ]}
            />

            <FilterSelect
              icon={<HangerIcon />}
              label="Type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: "all", label: "All types" },
                ...categories.map((category) => ({
                  value: category,
                  label: categoryLabel(category)
                }))
              ]}
            />

            <FilterSelect
              icon={<SunIcon />}
              label="Season"
              value={seasonFilter}
              onChange={setSeasonFilter}
              options={[
                { value: "all", label: "Any season" },
                ...seasonOptions.map((season) => ({
                  value: season,
                  label: categoryLabel(season)
                }))
              ]}
            />

            <FilterSelect
              icon={<PaletteIcon />}
              label="Colour"
              value={colourFilter}
              onChange={setColourFilter}
              options={[
                { value: "all", label: "Any colour" },
                ...canonicalWardrobeColours.map((colour) => ({
                  value: colour.family,
                  label: categoryLabel(colour.family)
                }))
              ]}
            />

            <FilterSelect
              icon={<TagIcon />}
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All statuses" },
                ...statuses.map((status) => ({
                  value: status,
                  label: categoryLabel(status)
                }))
              ]}
            />

            <FilterSelect
              icon={<SortIcon />}
              label="Sort"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: "newest", label: "Newest first" },
                { value: "cost_desc", label: "Cost per wear: high to low" },
                { value: "cost_asc", label: "Cost per wear: low to high" },
                { value: "favourites", label: "Favourites first" },
                { value: "most_worn", label: "Most worn" },
                { value: "price_desc", label: "Price: high to low" }
              ]}
            />
            </div>
          </div>

          <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max items-center gap-3">
            <button
              type="button"
              onClick={() => setFavouritesOnly((current) => !current)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                favouritesOnly
                  ? "border-[#e0bf4b] bg-[#fff7d6] text-[#8f6b00]"
                  : "border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[var(--surface)]"
              }`}
            >
              <StarIcon filled={favouritesOnly} />
              Favourites
            </button>
            <div className="flex flex-wrap gap-2">
              {canonicalWardrobeColours.slice(0, 6).map((colour) => (
                <button
                  key={colour.family}
                  type="button"
                  onClick={() =>
                    setColourFilter((current) =>
                      current === colour.family ? "all" : colour.family
                    )
                  }
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
                    colourFilter === colour.family
                      ? "border-[var(--foreground)] bg-white text-[var(--foreground)]"
                      : "border-[rgba(23,20,17,0.08)] bg-[var(--surface)] text-[var(--muted)]"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-black/10"
                    style={{ backgroundColor: colour.hex }}
                  />
                  {categoryLabel(colour.family)}
                </button>
              ))}
            </div>
            <span className="text-sm text-[var(--muted)]">
              {filteredGarments.length} result{filteredGarments.length === 1 ? "" : "s"}
            </span>
            </div>
          </div>

          {activeFilterChips.length ? (
            <div className="mt-4 border-t border-[rgba(23,20,17,0.08)] pt-4">
              <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-max items-center gap-2">
                  {activeFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.onClear}
                      className="inline-flex items-center gap-2 rounded-full border border-[rgba(23,20,17,0.1)] bg-white px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--surface)]"
                    >
                      {chip.label}
                      <span className="text-[var(--muted)]">
                        <CloseIcon />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {createState.message ? (
          <p
            className={`rounded-2xl border px-4 py-3 text-sm ${
              createState.status === "error" || createState.status === "partial"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
            }`}
          >
            {createState.message}
          </p>
        ) : null}

        {filteredGarments.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5">
            {filteredGarments.map((garment) => (
              <GarmentCard
                key={garment.id}
                garment={garment}
                onOpen={() => setActiveGarmentId(garment.id as string)}
                deleteGarmentAction={deleteGarmentAction}
                toggleGarmentFavouriteAction={toggleGarmentFavouriteAction}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/65 px-6 py-10 text-center">
            <p className="text-base font-semibold">No items match these filters</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Adjust the filter bar or add a new wardrobe item.
            </p>
          </div>
        )}
      </section>

      {isCreateOpen ? (
        <DialogShell onClose={() => setIsCreateOpen(false)}>
          <form action={createFormAction} className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-[var(--muted)]">
                  Add Item
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                  Create a new garment card
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                  Start with the photo and core identity. The longer wardrobe metadata can stay
                  secondary until you need it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-[1.2rem] bg-[rgba(23,20,17,0.04)] p-1 lg:hidden">
              <button
                type="button"
                onClick={() => setCreateMobileStep(1)}
                className={`rounded-[0.95rem] px-4 py-3 text-sm font-medium transition-colors ${
                  createMobileStep === 1
                    ? "bg-white text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)]"
                }`}
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => setCreateMobileStep(2)}
                className={`rounded-[0.95rem] px-4 py-3 text-sm font-medium transition-colors ${
                  createMobileStep === 2
                    ? "bg-white text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)]"
                }`}
              >
                Preview
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className={`space-y-5 ${createMobileStep === 1 ? "block" : "hidden"} lg:block`}>
                <CreateImageField onPreviewChange={setCreatePreviewImageUrl} />

                <div className="rounded-[1.5rem] border border-[rgba(23,20,17,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,243,236,0.9))] p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                        Core Identity
                      </p>
                      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                        Add the details you would want to see on the card immediately.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      Live preview
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <FormField
                      label="Title"
                      name="title"
                      placeholder="Black long sleeve top"
                      value={createPreviewTitle}
                      onChange={setCreatePreviewTitle}
                    />
                    <FormField
                      label="Brand"
                      name="brand"
                      placeholder="Viktoria & Woods"
                      value={createPreviewBrand}
                      onChange={setCreatePreviewBrand}
                    />
                    <FormField
                      label="Category"
                      name="category"
                      placeholder="top"
                      required
                      value={createPreviewCategory}
                      onChange={setCreatePreviewCategory}
                    />
                    <FormField
                      label="Subcategory"
                      name="subcategory"
                      placeholder="long sleeve"
                      value={createPreviewSubcategory}
                      onChange={setCreatePreviewSubcategory}
                    />
                    <ColourField value={createPreviewColour} onChange={setCreatePreviewColour} />
                    <FormField
                      label="Formality"
                      name="formality_level"
                      placeholder="smart casual"
                    />
                  </div>
                </div>
              </div>

              <div className={`${createMobileStep === 2 ? "block" : "hidden"} lg:block`}>
                <CreateGarmentPreviewCard
                  title={createPreviewTitle}
                  brand={createPreviewBrand}
                  category={createPreviewCategory}
                  subcategory={createPreviewSubcategory}
                  colourFamily={createPreviewColour}
                  price={createPreviewPrice}
                  currency={createPreviewCurrency}
                  previewUrl={createPreviewImageUrl}
                />
              </div>
            </div>

            {createState.message ? (
              <p
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  createState.status === "error" || createState.status === "partial"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
                }`}
              >
                {createState.message}
              </p>
            ) : null}

            <div
              className={`rounded-[1.5rem] border border-[rgba(23,20,17,0.08)] bg-white/80 ${
                createMobileStep === 1 ? "block" : "hidden"
              } lg:block`}
            >
              <button
                type="button"
                onClick={() => setIsCreateDetailsOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                    More Details
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Material, fit, sizing, purchase details, and seasonality.
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--muted)]">
                  <ChevronIcon open={isCreateDetailsOpen} />
                </span>
              </button>

              {isCreateDetailsOpen ? (
                <div className="border-t border-[rgba(23,20,17,0.08)] px-5 pb-5 pt-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Material" name="material" placeholder="wool blend" />
                    <FormField label="Size" name="size" placeholder="AU 10" />
                    <FormField label="Fit" name="fit" placeholder="relaxed" />
                    <FormField
                      label="Purchase Price"
                      name="purchase_price"
                      type="number"
                      step="0.01"
                      value={createPreviewPrice}
                      onChange={setCreatePreviewPrice}
                    />
                    <FormField
                      label="Currency"
                      name="purchase_currency"
                      placeholder="AUD"
                      value={createPreviewCurrency}
                      onChange={setCreatePreviewCurrency}
                    />
                    <FormField label="Purchase Date" name="purchase_date" type="date" />
                    <FormField label="Retailer" name="retailer" placeholder="David Jones" />
                  </div>

                  <fieldset className="mt-5">
                    <legend className="text-sm font-medium">Seasonality</legend>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {seasonOptions.map((season) => (
                        <label
                          key={season}
                          className="rounded-full border border-[var(--line)] px-3 py-2 text-sm"
                        >
                          <input
                            className="mr-2"
                            type="checkbox"
                            name="seasonality"
                            value={season}
                          />
                          {season}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 lg:hidden">
              {createMobileStep === 2 ? (
                <button
                  type="button"
                  onClick={() => setCreateMobileStep(1)}
                  className="rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-medium"
                >
                  Back To Details
                </button>
              ) : (
                <span />
              )}

              {createMobileStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setCreateMobileStep(2)}
                  className="rounded-full bg-[var(--foreground)] px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Review Card
                </button>
              ) : null}
            </div>

            <PendingButton idle="Add Item" pending="Adding Item..." />
          </form>
        </DialogShell>
      ) : null}

      {activeGarment ? (
        <GarmentDetailDialog
          garment={activeGarment}
          onClose={() => setActiveGarmentId(null)}
          addGarmentImageAction={addGarmentImageAction}
          deleteGarmentAction={deleteGarmentAction}
          toggleGarmentFavouriteAction={toggleGarmentFavouriteAction}
          logWearAction={logWearAction}
          updateGarmentAction={updateGarmentAction}
        />
      ) : null}

      {createSuccessToast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[rgba(23,20,17,0.08)] bg-[rgba(255,251,246,0.96)] px-4 py-3 text-sm text-[var(--foreground)] shadow-[0_18px_40px_rgba(40,25,12,0.14)] backdrop-blur-xl">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#eef8ec] text-[#2f6b33]">
              <CheckIcon />
            </span>
            <span className="font-medium">{createSuccessToast}</span>
          </div>
        </div>
      ) : null}
    </>
  );
}

function GarmentCard({
  garment,
  onOpen,
  deleteGarmentAction,
  toggleGarmentFavouriteAction
}: {
  garment: GarmentListItem;
  onOpen: () => void;
  deleteGarmentAction: (
    state: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
  toggleGarmentFavouriteAction: (
    state: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
}) {
  const [deleteState, deleteFormAction] = useActionState(
    deleteGarmentAction,
    wardrobeActionState
  );
  const [favouriteState, favouriteFormAction] = useActionState(
    toggleGarmentFavouriteAction,
    wardrobeActionState
  );

  return (
    <article className="group relative overflow-hidden rounded-[1.25rem] border border-[rgba(23,20,17,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,242,235,0.92))] shadow-[0_14px_30px_rgba(40,25,12,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(40,25,12,0.1)] sm:rounded-[1.6rem] sm:shadow-[0_18px_40px_rgba(40,25,12,0.06)]">
      <div className="absolute right-2 top-2 z-10 flex gap-1.5 opacity-100 transition-opacity duration-200 sm:right-3 sm:top-3 sm:gap-2 sm:opacity-0 sm:group-hover:opacity-100">
        <QuickIconForm
          action={favouriteFormAction}
          garmentId={garment.id as string}
          title={garment.favourite_score && garment.favourite_score > 0 ? "Remove favourite" : "Favourite item"}
          tone={garment.favourite_score && garment.favourite_score > 0 ? "favourite" : "light"}
          icon={<StarIcon filled={Boolean(garment.favourite_score && garment.favourite_score > 0)} />}
        />
        <QuickIconForm
          action={deleteFormAction}
          garmentId={garment.id as string}
          title="Delete item"
          tone="danger"
          icon={<TrashIcon />}
        />
      </div>

      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-[3/4] overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,232,220,0.9))] sm:aspect-[4/5]">
          {garment.preview_url ? (
            <img
              src={garment.preview_url}
              alt={garment.title || garment.category}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <img
                src="/illustrations/chatting.svg"
                alt=""
                aria-hidden="true"
                className="h-24 w-24 object-contain opacity-80"
              />
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                Add Image
              </p>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/10 to-transparent sm:h-24" />
        </div>

        <div className="space-y-2.5 p-3 sm:space-y-3 sm:p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] sm:text-[11px] sm:tracking-[0.24em]">
                {categoryLabel(garment.category)}
              </p>
              <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-5 tracking-[-0.03em] sm:text-lg sm:leading-6">
                {garment.title || garment.category}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)] sm:text-sm">
                {[garment.brand, garment.category, garment.subcategory]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <p className="shrink-0 rounded-full bg-[rgba(23,20,17,0.04)] px-2.5 py-1 text-right text-xs font-semibold sm:px-3 sm:py-1.5 sm:text-sm">
              {garment.purchase_price != null
                ? `${garment.purchase_currency || ""} ${garment.purchase_price}`
                : "n/a"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[0.9rem] bg-[rgba(23,20,17,0.04)] px-2.5 py-2 sm:rounded-[1rem] sm:px-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Status</p>
              <p className="mt-1 line-clamp-1 text-xs font-medium sm:text-sm">
                {categoryLabel(garment.wardrobe_status)}
              </p>
            </div>
            <div className="rounded-[0.9rem] bg-[rgba(23,20,17,0.04)] px-2.5 py-2 sm:rounded-[1rem] sm:px-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Wear Count</p>
              <p className="mt-1 text-xs font-medium sm:text-sm">{garment.wear_count}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] sm:gap-2 sm:text-xs sm:tracking-[0.15em]">
            {garment.primary_colour_family ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(23,20,17,0.08)] bg-white/80 px-2 py-1 sm:gap-2 sm:px-2.5">
                <span
                  className="h-2 w-2 rounded-full border border-black/10 sm:h-2.5 sm:w-2.5"
                  style={{ backgroundColor: garment.primary_colour_hex || "#d7c1a1" }}
                />
                {categoryLabel(garment.primary_colour_family)}
              </span>
            ) : null}
            <span className="rounded-full border border-[rgba(23,20,17,0.08)] bg-white/80 px-2 py-1 sm:px-2.5">
              {garment.wardrobe_status}
            </span>
            <span className="rounded-full border border-[rgba(23,20,17,0.08)] bg-white/80 px-2 py-1 sm:px-2.5">
              {garment.wear_count} wears
            </span>
            {garment.favourite_score && garment.favourite_score > 0 ? (
              <span className="rounded-full border border-[#e0bf4b] bg-[#fff7d6] px-2 py-1 text-[#8f6b00] sm:px-2.5">
                Favourite
              </span>
            ) : null}
          </div>
        </div>
      </button>

      {deleteState.status === "error" ? (
        <p className="px-4 pb-4 text-sm text-red-600">{deleteState.message}</p>
      ) : null}
      {favouriteState.status === "error" ? (
        <p className="px-4 pb-4 text-sm text-red-600">{favouriteState.message}</p>
      ) : null}
    </article>
  );
}

function QuickIconForm({
  action,
  garmentId,
  title,
  icon,
  tone
}: {
  action: (payload: FormData) => void;
  garmentId: string;
  title: string;
  icon: ReactNode;
  tone: "light" | "danger" | "favourite";
}) {
  return (
    <form action={action}>
      <input type="hidden" name="garment_id" value={garmentId} />
      <QuickIconButton title={title} tone={tone}>
        {icon}
      </QuickIconButton>
    </form>
  );
}

function QuickIconButton({
  children,
  title,
  tone
}: {
  children: ReactNode;
  title: string;
  tone: "light" | "danger" | "favourite";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      title={title}
      disabled={pending}
      className={`rounded-full p-2 shadow-sm backdrop-blur disabled:opacity-60 ${
        tone === "danger"
          ? "bg-white/92 text-red-600"
          : tone === "favourite"
            ? "bg-[#fff6cf] text-[#d3a300]"
          : "bg-white/92 text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

function GarmentDetailDialog({
  garment,
  onClose,
  addGarmentImageAction,
  deleteGarmentAction,
  toggleGarmentFavouriteAction,
  logWearAction,
  updateGarmentAction
}: {
  garment: GarmentListItem;
  onClose: () => void;
  addGarmentImageAction: (
    state: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
  deleteGarmentAction: (
    state: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
  toggleGarmentFavouriteAction: (
    state: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
  logWearAction: (
    state: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
  updateGarmentAction: (
    state: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
}) {
  const [wearState, wearFormAction] = useActionState(logWearAction, wardrobeActionState);
  const [editState, editFormAction] = useActionState(updateGarmentAction, wardrobeActionState);
  const [deleteState, deleteFormAction] = useActionState(
    deleteGarmentAction,
    wardrobeActionState
  );
  const [favouriteState, favouriteFormAction] = useActionState(
    toggleGarmentFavouriteAction,
    wardrobeActionState
  );

  useEffect(() => {
    if (deleteState.status === "success") {
      onClose();
    }
  }, [deleteState.status, onClose]);

  return (
    <DialogShell onClose={onClose} size="max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-[var(--muted)]">
            Garment Detail
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
            {garment.title || garment.category}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {[garment.brand, garment.category, garment.subcategory, garment.material]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <QuickIconForm
            action={favouriteFormAction}
            garmentId={garment.id as string}
            title={garment.favourite_score && garment.favourite_score > 0 ? "Remove favourite" : "Favourite item"}
            tone={garment.favourite_score && garment.favourite_score > 0 ? "favourite" : "light"}
            icon={<StarIcon filled={Boolean(garment.favourite_score && garment.favourite_score > 0)} />}
          />
          <QuickIconForm
            action={deleteFormAction}
            garmentId={garment.id as string}
            title="Delete item"
            tone="danger"
            icon={<TrashIcon />}
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-[rgba(23,20,17,0.08)] bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(246,239,232,0.9))] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              <span className="rounded-full border border-[rgba(23,20,17,0.08)] bg-white/80 px-3 py-1.5">
                {categoryLabel(garment.wardrobe_status)}
              </span>
              {garment.primary_colour_family ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(23,20,17,0.08)] bg-white/80 px-3 py-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-black/10"
                    style={{ backgroundColor: garment.primary_colour_hex || "#d7c1a1" }}
                  />
                  {categoryLabel(garment.primary_colour_family)}
                </span>
              ) : null}
              {garment.favourite_score && garment.favourite_score > 0 ? (
                <span className="rounded-full border border-[#e0bf4b] bg-[#fff7d6] px-3 py-1.5 text-[#8f6b00]">
                  Favourite
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-[var(--muted)]">
              <span>{garment.wear_count} wears logged</span>
              <span>
                Cost per wear:{" "}
                {garment.cost_per_wear != null
                  ? `${garment.purchase_currency || ""} ${garment.cost_per_wear}`
                  : "n/a"}
              </span>
              <span>
                Seasonality:{" "}
                {garment.seasonality.length ? garment.seasonality.join(", ") : "n/a"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Price" value={garment.purchase_price != null ? `${garment.purchase_currency || ""} ${garment.purchase_price}` : "n/a"} />
            <MiniStat label="Wear Count" value={String(garment.wear_count)} />
            <MiniStat
              label="Last Worn"
              value={garment.last_worn_at ? shortDateLabel(garment.last_worn_at) : "Not yet"}
            />
            <MiniStat
              label="Retailer"
              value={garment.retailer || garment.brand || "n/a"}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          {garment.preview_url ? (
            <div className="overflow-hidden rounded-[1.65rem] border border-[rgba(23,20,17,0.08)] bg-white shadow-[0_18px_40px_rgba(40,25,12,0.08)]">
              <img
                src={garment.preview_url}
                alt={garment.title || garment.category}
                className="h-[25rem] w-full object-cover sm:h-[30rem]"
              />
              <div className="border-t border-[rgba(23,20,17,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,239,232,0.9))] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                      Shop View
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      The primary image and wardrobe summary your future outfit flows will rely on.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Original
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <GarmentImageUpload
              garmentId={garment.id as string}
              action={addGarmentImageAction}
              latestPath={garment.images[0]?.storage_path ?? null}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Status" value={garment.wardrobe_status} />
            <StatCard label="Wear Count" value={String(garment.wear_count)} />
            <StatCard
              label="Colour"
              value={garment.primary_colour_family ? categoryLabel(garment.primary_colour_family) : "n/a"}
            />
            <StatCard
              label="Cost Per Wear"
              value={
                garment.cost_per_wear != null
                  ? `${garment.purchase_currency || ""} ${garment.cost_per_wear}`
                  : "n/a"
              }
            />
            <StatCard label="Seasonality" value={garment.seasonality.length ? garment.seasonality.join(", ") : "n/a"} />
          </div>
        </div>

        <div className="space-y-4">
          {garment.preview_url ? (
            <div className="rounded-[1.2rem] border border-[rgba(23,20,17,0.08)] bg-white/80 p-4">
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  Refresh Image
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Swap the hero image without leaving the garment detail view.
                </p>
              </div>
              <GarmentImageUpload
                garmentId={garment.id as string}
                action={addGarmentImageAction}
                latestPath={garment.images[0]?.storage_path ?? null}
              />
            </div>
          ) : null}

          <details className="rounded-[1.2rem] border border-[rgba(23,20,17,0.08)] bg-white/80 p-4" open>
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Edit Item
            </summary>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Update the wardrobe record without breaking the product-like browsing flow.
            </p>
            <form action={editFormAction} className="mt-4">
              <input type="hidden" name="garment_id" value={garment.id} />
              <div className="space-y-4">
                <section className="rounded-[1rem] border border-[rgba(23,20,17,0.07)] bg-[rgba(255,255,255,0.72)] p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                    Core Identity
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <FormField label="Title" name="title" defaultValue={garment.title || ""} />
                    <FormField label="Brand" name="brand" defaultValue={garment.brand || ""} />
                    <FormField
                      label="Category"
                      name="category"
                      defaultValue={garment.category}
                      required
                    />
                    <FormField
                      label="Subcategory"
                      name="subcategory"
                      defaultValue={garment.subcategory || ""}
                    />
                    <FormField
                      label="Material"
                      name="material"
                      defaultValue={garment.material || ""}
                    />
                    <FormField label="Size" name="size" defaultValue={garment.size || ""} />
                    <FormField label="Fit" name="fit" defaultValue={garment.fit || ""} />
                    <FormField
                      label="Formality"
                      name="formality_level"
                      defaultValue={garment.formality_level || ""}
                    />
                    <ColourField defaultValue={garment.primary_colour_family || ""} />
                  </div>
                </section>

                <details className="rounded-[1rem] border border-[rgba(23,20,17,0.07)] bg-[rgba(255,255,255,0.72)] p-4">
                  <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted)]">
                    Purchase Details
                  </summary>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <FormField
                      label="Purchase Price"
                      name="purchase_price"
                      type="number"
                      step="0.01"
                      defaultValue={
                        garment.purchase_price != null ? String(garment.purchase_price) : ""
                      }
                    />
                    <FormField
                      label="Currency"
                      name="purchase_currency"
                      defaultValue={garment.purchase_currency || ""}
                    />
                    <FormField
                      label="Purchase Date"
                      name="purchase_date"
                      type="date"
                      defaultValue={garment.purchase_date || ""}
                    />
                    <FormField
                      label="Retailer"
                      name="retailer"
                      defaultValue={garment.retailer || ""}
                    />
                  </div>
                </details>
              </div>

              <fieldset className="mt-4">
                <legend className="text-sm font-medium">Seasonality</legend>
                <div className="mt-3 flex flex-wrap gap-3">
                  {seasonOptions.map((season) => (
                    <label
                      key={season}
                      className="rounded-full border border-[var(--line)] px-3 py-2 text-sm"
                    >
                      <input
                        className="mr-2"
                        type="checkbox"
                        name="seasonality"
                        value={season}
                        defaultChecked={garment.seasonality.includes(season)}
                      />
                      {season}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-4 flex justify-center">
                <PendingButton idle="Save Item Changes" pending="Saving..." compact />
              </div>
              {editState.message ? (
                <p
                  className={`mt-3 text-sm ${
                    editState.status === "error" ? "text-red-600" : "text-[var(--muted)]"
                  }`}
                >
                  {editState.message}
                </p>
              ) : null}
            </form>
          </details>

          <form action={wearFormAction} className="rounded-[1.2rem] border border-[rgba(23,20,17,0.08)] bg-white/80 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Log Wear
            </h4>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Keep the wardrobe history current so cost-per-wear and planning stay accurate.
            </p>
            <input type="hidden" name="garment_id" value={garment.id} />
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <FormField label="Worn At" name="worn_at" type="datetime-local" />
              <FormField label="Occasion" name="occasion" placeholder="office" />
            </div>
            <div className="mt-3">
              <FormField label="Notes" name="notes" placeholder="Paired with loafers" />
            </div>
            <div className="mt-4 flex justify-center">
              <PendingButton idle="Save Wear Event" pending="Saving..." compact />
            </div>
            {wearState.message ? (
              <p
                className={`mt-3 text-sm ${
                  wearState.status === "error" ? "text-red-600" : "text-[var(--muted)]"
                }`}
              >
                {wearState.message}
              </p>
            ) : null}
          </form>
          <section className="rounded-[1.2rem] border border-[rgba(23,20,17,0.08)] bg-white/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Recent Activity
                </h4>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  The last few wears for this piece, directly in the detail view.
                </p>
              </div>
              <span className="rounded-full bg-[rgba(23,20,17,0.04)] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                {garment.recent_wear_events.length} recent
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {garment.recent_wear_events.length ? (
                garment.recent_wear_events.map((event) => (
                  <article
                    key={event.id}
                    className="rounded-[1rem] border border-[rgba(23,20,17,0.07)] bg-[rgba(255,255,255,0.72)] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          {event.occasion || "Wear logged"}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {shortDateTimeLabel(event.worn_at)}
                        </p>
                      </div>
                      <span className="rounded-full bg-[rgba(23,20,17,0.04)] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                        Wear
                      </span>
                    </div>
                    {event.notes ? (
                      <p className="mt-3 text-sm text-[var(--muted)]">{event.notes}</p>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="rounded-[1rem] border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.72)] px-4 py-5 text-sm text-[var(--muted)]">
                  No recent wear activity for this item yet.
                </div>
              )}
            </div>
          </section>

          <Link
            href={`/outfits?mode=plan&item=${garment.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Generate outfit with this →
          </Link>

          {deleteState.status === "error" ? (
            <p className="text-sm text-red-600">{deleteState.message}</p>
          ) : null}
          {favouriteState.status === "error" ? (
            <p className="text-sm text-red-600">{favouriteState.message}</p>
          ) : null}
        </div>
      </div>
    </DialogShell>
  );
}

function DialogShell({
  children,
  onClose,
  size = "max-w-4xl"
}: {
  children: ReactNode;
  onClose: () => void;
  size?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`max-h-[92vh] w-full ${size} overflow-auto rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.16)] md:p-8`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function CreateImageField({
  onPreviewChange
}: {
  onPreviewChange?: (previewUrl: string | null) => void;
}) {
  const inputId = useId();
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      onPreviewChange?.(null);
    };
  }, [onPreviewChange, previewUrl]);

  return (
    <div className="block">
      <label htmlFor={inputId} className="text-sm font-medium">
        Garment Image
      </label>
      <div
        className={`relative mt-2 overflow-hidden rounded-[1.5rem] border-2 border-dashed transition-colors ${
          previewUrl
            ? "border-transparent bg-white"
            : dragActive
              ? "border-[var(--accent)] bg-[rgba(166,99,60,0.07)]"
              : "border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,239,232,0.85))]"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);

          const file = event.dataTransfer.files?.[0] ?? null;

          if (!file || !file.type.startsWith("image/")) {
            return;
          }

          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }

          setFileName(file.name);
          const nextPreviewUrl = URL.createObjectURL(file);
          setPreviewUrl(nextPreviewUrl);
          onPreviewChange?.(nextPreviewUrl);

          const input = event.currentTarget.querySelector(
            'input[type="file"]'
          ) as HTMLInputElement | null;

          if (input) {
            const transfer = new DataTransfer();
            transfer.items.add(file);
            input.files = transfer.files;
          }
        }}
      >
        {previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Selected garment preview"
              className="h-80 w-full object-contain bg-[rgba(0,0,0,0.03)]"
            />
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();

                if (previewUrl) {
                  URL.revokeObjectURL(previewUrl);
                }

                setFileName(null);
                setPreviewUrl(null);
                onPreviewChange?.(null);

                const input = event.currentTarget
                  .parentElement
                  ?.querySelector('input[type="file"]') as HTMLInputElement | null;

                if (input) {
                  input.value = "";
                }
              }}
              className="absolute right-4 top-4 rounded-full bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white"
            >
              Remove
            </button>
            <div className="border-t border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,239,232,0.88))] px-5 py-4">
              <p className="text-sm font-semibold">{fileName || "Image selected"}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                This image will be uploaded as the original garment photo when the item is created.
              </p>
            </div>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex cursor-pointer flex-col items-center justify-center px-6 py-10 text-center"
          >
            <img
              src="/illustrations/chatting.svg"
              alt=""
              aria-hidden="true"
              className="mb-5 h-28 w-28 object-contain opacity-90"
            />
            <p className="text-base font-semibold tracking-[-0.02em]">
              Click to upload garment image
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">or drag and drop</p>
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
              Start with the item photo, then fill in the wardrobe metadata underneath.
            </p>
          </label>
        )}

        <input
          suppressHydrationWarning
          id={inputId}
          className="sr-only"
          name="image"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;

            if (previewUrl) {
              URL.revokeObjectURL(previewUrl);
            }

            if (!file) {
              setFileName(null);
              setPreviewUrl(null);
              onPreviewChange?.(null);
              return;
            }

            setFileName(file.name);
            const nextPreviewUrl = URL.createObjectURL(file);
            setPreviewUrl(nextPreviewUrl);
            onPreviewChange?.(nextPreviewUrl);
          }}
        />
      </div>
    </div>
  );
}

function FilterSelect({
  icon,
  label,
  value,
  onChange,
  options
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex items-center gap-3 rounded-[1.1rem] border border-[rgba(23,20,17,0.08)] bg-[linear-gradient(180deg,#fff,#fbf7f1)] px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <span className="text-[var(--muted)]">{icon}</span>
      <select
        suppressHydrationWarning
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="w-full bg-transparent outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CreateGarmentPreviewCard({
  title,
  brand,
  category,
  subcategory,
  colourFamily,
  price,
  currency,
  previewUrl
}: {
  title: string;
  brand: string;
  category: string;
  subcategory: string;
  colourFamily: string;
  price: string;
  currency: string;
  previewUrl: string | null;
}) {
  const colour = canonicalWardrobeColours.find((entry) => entry.family === colourFamily) ?? null;
  const displayCategory = category.trim() || "wardrobe item";
  const displayTitle = title.trim() || "Untitled piece";
  const displayMeta = [brand.trim(), category.trim(), subcategory.trim()]
    .filter(Boolean)
    .join(" · ");
  const readinessChecks = [
    {
      key: "image",
      label: "Image attached",
      complete: Boolean(previewUrl),
      missingLabel: "Add an image"
    },
    {
      key: "title",
      label: "Title added",
      complete: Boolean(title.trim()),
      missingLabel: "Add a title"
    },
    {
      key: "category",
      label: "Category selected",
      complete: Boolean(category.trim()),
      missingLabel: "Choose a category"
    },
    {
      key: "colour",
      label: "Colour captured",
      complete: Boolean(colourFamily.trim()),
      missingLabel: "Pick a colour"
    }
  ];
  const missingChecks = readinessChecks.filter((check) => !check.complete);

  return (
    <div className="space-y-4 rounded-[1.6rem] border border-[rgba(23,20,17,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,242,235,0.92))] p-4 shadow-[0_18px_40px_rgba(40,25,12,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Card Preview</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            This is how the item will read in your shop.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          Live
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-[1.35rem] border border-[rgba(23,20,17,0.08)] bg-white">
        <div className="relative aspect-[4/5] overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,232,220,0.9))]">
          {previewUrl ? (
            <img src={previewUrl} alt={displayTitle} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <img
                src="/illustrations/chatting.svg"
                alt=""
                aria-hidden="true"
                className="h-24 w-24 object-contain opacity-80"
              />
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                Add Image
              </p>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/10 to-transparent" />
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                {categoryLabel(displayCategory)}
              </p>
              <h3 className="mt-1 line-clamp-2 text-lg font-semibold leading-6 tracking-[-0.03em]">
                {displayTitle}
              </h3>
              <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                {displayMeta || "Brand, category, and subcategory will appear here."}
              </p>
            </div>
            <p className="shrink-0 rounded-full bg-[rgba(23,20,17,0.04)] px-3 py-1.5 text-right text-sm font-semibold">
              {price.trim() ? `${currency.trim() || "AUD"} ${price.trim()}` : "n/a"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[1rem] bg-[rgba(23,20,17,0.04)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Status</p>
              <p className="mt-1 text-sm font-medium">active</p>
            </div>
            <div className="rounded-[1rem] bg-[rgba(23,20,17,0.04)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Wear Count</p>
              <p className="mt-1 text-sm font-medium">0</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.15em] text-[var(--muted)]">
            {colour ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(23,20,17,0.08)] bg-white/80 px-2.5 py-1">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-black/10"
                  style={{ backgroundColor: colour.hex }}
                />
                {categoryLabel(colour.family)}
              </span>
            ) : null}
            <span className="rounded-full border border-[rgba(23,20,17,0.08)] bg-white/80 px-2.5 py-1">
              active
            </span>
            <span className="rounded-full border border-[rgba(23,20,17,0.08)] bg-white/80 px-2.5 py-1">
              0 wears
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-[1.25rem] border border-[rgba(23,20,17,0.08)] bg-white/78 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Review</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {missingChecks.length
                ? "A few details are still missing before this card feels complete."
                : "This card is ready to add to your shop."}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.18em] ${
              missingChecks.length
                ? "bg-[rgba(23,20,17,0.05)] text-[var(--muted)]"
                : "bg-[#eef8ec] text-[#2f6b33]"
            }`}
          >
            {missingChecks.length ? `${missingChecks.length} to finish` : "Ready"}
          </span>
        </div>

        <div className="mt-4 grid gap-2">
          {readinessChecks.map((check) => (
            <div
              key={check.key}
              className={`flex items-center justify-between gap-3 rounded-[0.95rem] px-3 py-2.5 text-sm ${
                check.complete
                  ? "bg-[#f3f9f1] text-[#2f6b33]"
                  : "bg-[rgba(23,20,17,0.04)] text-[var(--foreground)]"
              }`}
            >
              <span>{check.complete ? check.label : check.missingLabel}</span>
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                  check.complete
                    ? "border-[#b9dbb7] bg-white text-[#2f6b33]"
                    : "border-[rgba(23,20,17,0.08)] bg-white text-[var(--muted)]"
                }`}
              >
                {check.complete ? <CheckIcon /> : <DotIcon />}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PendingButton({
  idle,
  pending,
  tone = "default",
  compact = false
}: {
  idle: string;
  pending: string;
  tone?: "default" | "danger";
  compact?: boolean;
}) {
  const { pending: isPending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={isPending}
      className={`${compact ? "" : "mt-4"} rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60 ${
        tone === "danger"
          ? "border border-red-200 bg-red-50 text-red-700"
          : "border border-[var(--line)] bg-white"
      }`}
    >
      {isPending ? pending : idle}
    </button>
  );
}

function FormField({
  label,
  name,
  type = "text",
  placeholder,
  required,
  step,
  defaultValue,
  value,
  onChange
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  step?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <input
        suppressHydrationWarning
        className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        step={step}
        defaultValue={defaultValue}
        value={value}
        onChange={
          onChange
            ? (event) => {
                onChange(event.target.value);
              }
            : undefined
        }
      />
    </label>
  );
}

function ColourField({
  defaultValue = "",
  value,
  onChange
}: {
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">Primary Colour</span>
      <div className="rounded-[1.2rem] border border-[rgba(23,20,17,0.08)] bg-[linear-gradient(180deg,#fff,#fbf7f1)] p-3">
        <select
          suppressHydrationWarning
          name="primary_colour_family"
          defaultValue={defaultValue}
          value={value}
          onChange={
            onChange
              ? (event) => {
                  onChange(event.target.value);
                }
              : undefined
          }
          className="w-full bg-transparent pb-3 outline-none"
        >
          <option value="">Choose a colour family</option>
          {canonicalWardrobeColours.map((colour) => (
            <option key={colour.family} value={colour.family}>
              {categoryLabel(colour.family)}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-6 gap-2">
          {canonicalWardrobeColours.map((colour) => (
            <span
              key={colour.family}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10"
              style={{ backgroundColor: colour.hex }}
              title={categoryLabel(colour.family)}
            />
          ))}
        </div>
      </div>
    </label>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--line)] bg-white/70 p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[rgba(23,20,17,0.08)] bg-white/82 px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function categoryLabel(value: string) {
  return value.replaceAll("_", " ");
}

function occasionLabel(value: string) {
  return value.replaceAll("_", " ");
}

function shortDateLabel(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short"
  });
}

function shortDateTimeLabel(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}

function sortLabel(value: string) {
  switch (value) {
    case "cost_desc":
      return "Cost per wear: high to low";
    case "cost_asc":
      return "Cost per wear: low to high";
    case "favourites":
      return "Favourites first";
    case "most_worn":
      return "Most worn";
    case "price_desc":
      return "Price: high to low";
    default:
      return "Newest first";
  }
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M12.5 12.5L17 17" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.8]">
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 fill-none stroke-current stroke-[1.8] transition-transform ${
        open ? "rotate-180" : ""
      }`}
    >
      <path d="M5 8l5 5 5-5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
      <path d="M4.5 10.5 8 14l7.5-8" />
    </svg>
  );
}

function DotIcon() {
  return <span className="block h-2 w-2 rounded-full bg-current" />;
}

function OccasionIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <rect x="3" y="5" width="14" height="12" rx="2" />
      <path d="M6 3v4M14 3v4M3 9h14" />
    </svg>
  );
}

function HangerIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M10 5a2 2 0 1 0-2-2" />
      <path d="M10 5c0 2-5.5 3.3-6.5 6.5h13C15.5 8.3 10 7 10 5Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3M4 4l2 2M14 14l2 2M16 4l-2 2M6 14l-2 2" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M3 10.5V4h6.5L17 11.5 11.5 17 3 10.5Z" />
      <circle cx="7" cy="7" r="1" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M6 4v12M6 16l-2-2M6 16l2-2M14 16V4M14 4l-2 2M14 4l2 2" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M10 3a7 7 0 1 0 0 14h1.2c1.4 0 2.3-1.5 1.6-2.7-.5-.9.1-2.1 1.2-2.1H15a4 4 0 0 0 0-8h-5Z" />
      <circle cx="6.5" cy="9" r="1" />
      <circle cx="9.5" cy="7" r="1" />
      <circle cx="12.5" cy="8.5" r="1" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z" />
    </svg>
  );
}

function WearIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M10 3v7l4 2" />
      <circle cx="10" cy="10" r="6.5" />
    </svg>
  );
}

function StarIcon({ filled = false }: { filled?: boolean }) {
  return filled ? (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
      <path d="m10 2.8 2.2 4.4 4.9.7-3.5 3.4.8 4.8-4.4-2.3-4.4 2.3.8-4.8L2.9 7.9l4.9-.7L10 2.8Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="m10 2.8 2.2 4.4 4.9.7-3.5 3.4.8 4.8-4.4-2.3-4.4 2.3.8-4.8L2.9 7.9l4.9-.7L10 2.8Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M4 6h12M7.5 6V4.5h5V6M6.5 6l.5 9h6l.5-9M8.5 8.5v4.5M11.5 8.5v4.5" />
    </svg>
  );
}
