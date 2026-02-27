import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface EmployeeRow {
  name: string;
  position: string;
  company: string;
  total_amount: number;
  white_salary: number;
  gray_salary: number;
  advance: number;
  ndfl: number;
  contributions: number;
  bonus: number;
  next_month_bonus: number;
  cost: number;
  net_salary: number;
  paid_total: number;
}

interface DepartmentData {
  name: string;
  employees: EmployeeRow[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

let cachedFontBase64: string | null = null;
let cachedBoldFontBase64: string | null = null;

async function loadRobotoFont(): Promise<{ regular: string | null; bold: string | null }> {
  if (cachedFontBase64 && cachedBoldFontBase64) {
    return { regular: cachedFontBase64, bold: cachedBoldFontBase64 };
  }

  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch("https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.ttf"),
      fetch("https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuaabWmT.ttf"),
    ]);

    if (!regularRes.ok || !boldRes.ok) throw new Error("Font fetch failed");

    const [regularBuf, boldBuf] = await Promise.all([
      regularRes.arrayBuffer(),
      boldRes.arrayBuffer(),
    ]);

    cachedFontBase64 = arrayBufferToBase64(regularBuf);
    cachedBoldFontBase64 = arrayBufferToBase64(boldBuf);
    return { regular: cachedFontBase64, bold: cachedBoldFontBase64 };
  } catch (e) {
    console.warn("Could not load Roboto font:", e);
    return { regular: null, bold: null };
  }
}

export async function exportPayrollToPdf(
  departments: DepartmentData[],
  monthLabel: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const fonts = await loadRobotoFont();
  let fontName = "helvetica";

  if (fonts.regular) {
    doc.addFileToVFS("Roboto-Regular.ttf", fonts.regular);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    fontName = "Roboto";
  }
  if (fonts.bold) {
    doc.addFileToVFS("Roboto-Bold.ttf", fonts.bold);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  }

  doc.setFont(fontName, "normal");

  const columns = [
    { header: "Сотрудник", dataKey: "name" },
    { header: "Должность", dataKey: "position" },
    { header: "Проект", dataKey: "company" },
    { header: "Общая\nсумма", dataKey: "total_amount" },
    { header: "Белая", dataKey: "white_salary" },
    { header: "Серая", dataKey: "gray_salary" },
    { header: "Аванс", dataKey: "advance" },
    { header: "НДФЛ", dataKey: "ndfl" },
    { header: "Взносы", dataKey: "contributions" },
    { header: "Премия", dataKey: "bonus" },
    { header: "Премия\nсл. мес", dataKey: "next_month_bonus" },
    { header: "Стоимость", dataKey: "cost" },
    { header: "На руки", dataKey: "net_salary" },
    { header: "Выплачено", dataKey: "paid_total" },
  ];

  doc.setFontSize(16);
  doc.text(`Зарплатный табель — ${monthLabel}`, 14, 15);

  let startY = 22;

  for (const dept of departments) {
    if (startY > 180) {
      doc.addPage();
      startY = 15;
    }

    doc.setFontSize(12);
    doc.text(dept.name, 14, startY);
    startY += 4;

    const body = dept.employees.map((e) => ({
      name: e.name,
      position: e.position || "",
      company: e.company,
      total_amount: fmt(e.total_amount),
      white_salary: fmt(e.white_salary),
      gray_salary: fmt(e.gray_salary),
      advance: fmt(e.advance),
      ndfl: fmt(e.ndfl),
      contributions: fmt(e.contributions),
      bonus: fmt(e.bonus),
      next_month_bonus: fmt(e.next_month_bonus),
      cost: fmt(e.cost),
      net_salary: fmt(e.net_salary),
      paid_total: fmt(e.paid_total),
    }));

    const totals = dept.employees.reduce(
      (acc, e) => ({
        total_amount: acc.total_amount + e.total_amount,
        white_salary: acc.white_salary + e.white_salary,
        gray_salary: acc.gray_salary + e.gray_salary,
        advance: acc.advance + e.advance,
        ndfl: acc.ndfl + e.ndfl,
        contributions: acc.contributions + e.contributions,
        bonus: acc.bonus + e.bonus,
        next_month_bonus: acc.next_month_bonus + e.next_month_bonus,
        cost: acc.cost + e.cost,
        net_salary: acc.net_salary + e.net_salary,
        paid_total: acc.paid_total + e.paid_total,
      }),
      {
        total_amount: 0, white_salary: 0, gray_salary: 0, advance: 0,
        ndfl: 0, contributions: 0, bonus: 0, next_month_bonus: 0,
        cost: 0, net_salary: 0, paid_total: 0,
      }
    );

    body.push({
      name: "ИТОГО",
      position: "",
      company: "",
      total_amount: fmt(totals.total_amount),
      white_salary: fmt(totals.white_salary),
      gray_salary: fmt(totals.gray_salary),
      advance: fmt(totals.advance),
      ndfl: fmt(totals.ndfl),
      contributions: fmt(totals.contributions),
      bonus: fmt(totals.bonus),
      next_month_bonus: fmt(totals.next_month_bonus),
      cost: fmt(totals.cost),
      net_salary: fmt(totals.net_salary),
      paid_total: fmt(totals.paid_total),
    });

    autoTable(doc, {
      startY,
      columns,
      body,
      styles: {
        font: fontName,
        fontSize: 7,
        cellPadding: 1.5,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontSize: 7,
        font: fontName,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        name: { cellWidth: 30 },
        position: { cellWidth: 22 },
        company: { cellWidth: 18 },
        total_amount: { halign: "right", cellWidth: 18 },
        white_salary: { halign: "right", cellWidth: 16 },
        gray_salary: { halign: "right", cellWidth: 16 },
        advance: { halign: "right", cellWidth: 16 },
        ndfl: { halign: "right", cellWidth: 16 },
        contributions: { halign: "right", cellWidth: 16 },
        bonus: { halign: "right", cellWidth: 16 },
        next_month_bonus: { halign: "right", cellWidth: 18 },
        cost: { halign: "right", cellWidth: 18 },
        net_salary: { halign: "right", cellWidth: 16 },
        paid_total: { halign: "right", cellWidth: 18 },
      },
      didParseCell: (data) => {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [220, 230, 241];
        }
      },
    });

    startY = (doc as any).lastAutoTable.finalY + 8;
  }

  doc.save(`Зарплатный_табель_${monthLabel.replace(/\s/g, "_")}.pdf`);
}
