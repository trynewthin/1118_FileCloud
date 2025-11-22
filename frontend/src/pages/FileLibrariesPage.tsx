import { useFileLibraries } from "@/hooks/useFileLibraries";
import { PageContainer } from "@/components/layout/PageContainer";
import { LibraryCard } from "@/components/file-libraries/LibraryCard";
import { NewLibraryDialog } from "@/components/file-libraries/NewLibraryDialog";
import { GlassCard } from "@/components/common/GlassCard";
import { DS } from "@/lib/design-system";
import { cn } from "@/lib/utils";

export function FileLibrariesPage() {
  const { items, loading, error, refresh, remove, reload } = useFileLibraries();

  return (
    <PageContainer
      title="文件库管理"
      action={<NewLibraryDialog onSuccess={reload} />}
    >
      {error && <div className="mb-4 text-sm text-red-500 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-md">{error}</div>}

      {loading && items.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
           {[1, 2, 3].map((i) => (
             <GlassCard key={i} variant="lite" className="h-48 animate-pulse bg-muted/10" />
           ))}
        </div>
      ) : items.length === 0 ? (
        <GlassCard variant="ghost" className="flex h-64 flex-col items-center justify-center border-dashed border-2 border-muted">
          <div className="flex flex-col items-center gap-2 text-center">
             <div className="p-3 bg-muted/20 rounded-full">
               <div className="w-8 h-8 bg-muted/30 rounded-full" />
             </div>
             <div className="space-y-1">
                <h3 className={cn("text-lg", DS.text.heading)}>暂无文件库</h3>
                <p className={DS.text.caption}>创建一个文件库来开始管理您的文件</p>
             </div>
          </div>
          <div className="mt-6">
            <NewLibraryDialog onSuccess={reload} />
          </div>
        </GlassCard>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
