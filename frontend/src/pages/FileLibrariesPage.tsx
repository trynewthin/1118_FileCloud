import { useFileLibraries } from "@/hooks/useFileLibraries";
import { PageContainer } from "@/components/layout/PageContainer";
import { LibraryCard } from "@/components/file-libraries/LibraryCard";
import { NewLibraryDialog } from "@/components/file-libraries/NewLibraryDialog";

export function FileLibrariesPage() {
  const { items, loading, error, refresh, remove, reload } = useFileLibraries();

  return (
    <PageContainer
      title="文件库管理"
      action={<NewLibraryDialog onSuccess={reload} />}
    >
      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

      {loading && items.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
           {[1, 2, 3].map((i) => (
             <div key={i} className="h-40 rounded-xl border bg-muted/20 animate-pulse" />
           ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 text-center">
          <p className="text-muted-foreground mb-4">暂无文件库</p>
          <NewLibraryDialog onSuccess={reload} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((lib) => (
            <LibraryCard
              key={lib.id}
              library={lib}
              onRefresh={refresh}
              onDelete={remove}
              loading={loading}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
