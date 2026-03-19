import { AppLayout } from "@/components/layout";
import { useGetAssets } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, File, Image as ImageIcon, Link as LinkIcon, Plus } from "lucide-react";

export default function Assets() {
  const { data: assets, isLoading } = useGetAssets();

  const getIconForCategory = (category: string) => {
    if (category.includes("Photo") || category.includes("Brand")) return <ImageIcon className="h-8 w-8 text-accent" />;
    if (category.includes("Link")) return <LinkIcon className="h-8 w-8 text-blue-500" />;
    return <File className="h-8 w-8 text-primary" />;
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Marketing Assets</h1>
            <p className="text-muted-foreground mt-1">Decks, case studies, and brand collateral.</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25">
            <Plus className="h-4 w-4 mr-2" /> Add Asset
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading assets...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {assets?.map(asset => (
              <Card key={asset.id} className="bg-card border-border/50 shadow-sm rounded-2xl hover:shadow-md transition-all group overflow-hidden flex flex-col">
                <div className="h-32 bg-muted flex items-center justify-center border-b border-border/50 group-hover:bg-primary/5 transition-colors relative">
                  {getIconForCategory(asset.category)}
                  {asset.url && (
                    <a 
                      href={asset.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="absolute top-3 right-3 p-2 bg-background rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{asset.category}</span>
                  <h3 className="font-bold text-base leading-tight text-foreground">{asset.title}</h3>
                  {asset.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{asset.description}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
