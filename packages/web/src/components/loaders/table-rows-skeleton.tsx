import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

type TableRowsSkeletonProps = {
  rows?: number;
  columns: number;
};

export function TableRowsSkeleton({ rows = 5, columns }: TableRowsSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <TableCell key={columnIndex}>
              <Skeleton
                className="h-4"
                style={{ width: columnIndex === 0 ? "72%" : columnIndex === columns - 1 ? "40%" : "55%" }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
