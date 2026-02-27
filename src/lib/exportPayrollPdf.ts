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

  const pageWidth = doc.internal.pageSize.getWidth();

  // ===== HEADER =====
  // Top accent line
  doc.setFillColor(25, 60, 112);
  doc.rect(0, 0, pageWidth, 2, "F");

  // Title block
  doc.setFontSize(20);
  doc.setFont(fontName, "bold");
  doc.setTextColor(25, 60, 112);
  doc.text("ЗАРПЛАТНЫЙ ТАБЕЛЬ", 14, 14);

  doc.setFontSize(13);
  doc.setFont(fontName, "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(monthLabel, 14, 21);

  // Date of generation
  const now = new Date();
  const dateStr = `Сформировано: ${now.toLocaleDateString("ru-RU")} ${now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(dateStr, pageWidth - 14, 21, { align: "right" });

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, 24, pageWidth - 14, 24);

  doc.setTextColor(0, 0, 0);

  const columns = [
    { header: "Сотрудник", dataKey: "name" },
    { header: "Должность", dataKey: "position" },
    { header: "Проект", dataKey: "company" },
    { header: "Общая сумма", dataKey: "total_amount" },
    { header: "Белая", dataKey: "white_salary" },
    { header: "Серая", dataKey: "gray_salary" },
    { header: "Аванс", dataKey: "advance" },
    { header: "НДФЛ", dataKey: "ndfl" },
    { header: "Взносы", dataKey: "contributions" },
    { header: "Премия", dataKey: "bonus" },
    { header: "Премия сл.м.", dataKey: "next_month_bonus" },
    { header: "Стоимость", dataKey: "cost" },
    { header: "На руки", dataKey: "net_salary" },
    { header: "Выплачено", dataKey: "paid_total" },
  ];

  let startY = 28;

  for (let di = 0; di < departments.length; di++) {
    const dept = departments[di];

    if (startY > 170) {
      doc.addPage();
      startY = 14;
    }

    // Department header with accent
    doc.setFillColor(25, 60, 112);
    doc.roundedRect(14, startY - 1, pageWidth - 28, 7, 1, 1, "F");
    doc.setFontSize(11);
    doc.setFont(fontName, "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(dept.name.toUpperCase(), 18, startY + 4);
    doc.setTextColor(0, 0, 0);
    startY += 9;

    const body = dept.employees.map((e) => ({
      name: e.name,
      position: e.position || "—",
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
      margin: { left: 14, right: 14 },
      tableWidth: "auto",
      styles: {
        font: fontName,
        fontSize: 9,
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
        textColor: [30, 30, 30],
        lineColor: [200, 200, 200],
        lineWidth: 0.2,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [44, 82, 130],
        textColor: [255, 255, 255],
        fontSize: 8,
        font: fontName,
        fontStyle: "bold",
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
        halign: "center",
      },
      bodyStyles: {
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [240, 245, 250],
      },
      columnStyles: {
        name: { cellWidth: 32, fontStyle: "bold" },
        position: { cellWidth: 24, textColor: [100, 100, 100], fontSize: 8 },
        company: { cellWidth: 20 },
        total_amount: { halign: "right", cellWidth: 19, fontStyle: "bold" },
        white_salary: { halign: "right", cellWidth: 17 },
        gray_salary: { halign: "right", cellWidth: 17 },
        advance: { halign: "right", cellWidth: 17 },
        ndfl: { halign: "right", cellWidth: 17 },
        contributions: { halign: "right", cellWidth: 17 },
        bonus: { halign: "right", cellWidth: 17 },
        next_month_bonus: { halign: "right", cellWidth: 19 },
        cost: { halign: "right", cellWidth: 19 },
        net_salary: { halign: "right", cellWidth: 17, fontStyle: "bold", textColor: [0, 100, 0] },
        paid_total: { halign: "right", cellWidth: 19 },
      },
      didParseCell: (data) => {
        // Bold totals row with accent background
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [25, 60, 112];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontSize = 9;
        }
      },
    });

    startY = (doc as any).lastAutoTable.finalY + 10;
  }

  // ===== FOOTER on last page =====
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
  doc.setFontSize(7);
  doc.setFont(fontName, "normal");
  doc.setTextColor(160, 160, 160);
  doc.text("Документ сформирован автоматически • PNL Tracker", 14, pageHeight - 8);
  doc.text(`Страница ${doc.getNumberOfPages()}`, pageWidth - 14, pageHeight - 8, { align: "right" });

  doc.save(`Зарплатный_табель_${monthLabel.replace(/\s/g, "_")}.pdf`);
}
