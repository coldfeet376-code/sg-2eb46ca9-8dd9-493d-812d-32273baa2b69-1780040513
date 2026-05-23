import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Assignment, StaffMember, FairnessMetrics } from "@/types";
import type { ManagerAssignment } from "@/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];
const DUTIES = ["Intake", "Out-loading", "Admin", "Floor"];

interface StaffReportData {
  weekStart: Date;
  assignments: Assignment[];
  staff: StaffMember[];
  fairnessMetrics: FairnessMetrics | null;
  lockedCount: number;
}

interface ManagerReportData {
  weekStart: Date;
  assignments: ManagerAssignment[];
  managers: Array<{ id: string; name: string }>;
}

export function generateStaffRotaPDF(data: StaffReportData): void {
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  const weekDates = DAYS.map((_, i) => {
    const date = new Date(data.weekStart);
    date.setDate(data.weekStart.getDate() + i);
    return date;
  });

  // Header with branding
  doc.setFillColor(33, 150, 243);
  doc.rect(0, 0, 297, 25, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("GIST WAREHOUSE ROTA", 15, 13);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Staff Weekly Schedule", 15, 20);

  // Date range
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Week: ${weekDates[0].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - ${weekDates[6].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
    15,
    35
  );

  // Metrics summary box
  if (data.fairnessMetrics) {
    doc.setFillColor(240, 248, 255);
    doc.roundedRect(200, 30, 82, 20, 2, 2, "F");
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Fairness Score:", 205, 36);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 150, 243);
    doc.text(`${data.fairnessMetrics.overallScore}`, 205, 44);
    
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.text(`Locked: ${data.lockedCount}`, 235, 36);
    doc.text(`Staff: ${data.staff.length}`, 235, 42);
    doc.text(`Coverage: ${Math.round((data.assignments.length / (data.staff.length * 7)) * 100)}%`, 235, 48);
  }

  // Rota table
  const tableData: string[][] = [];
  TASKS.forEach((task) => {
    const row: string[] = [task];
    weekDates.forEach((date) => {
      const dateStr = date.toISOString().split("T")[0];
      const dayAssignments = data.assignments.filter(
        (a) => a.task === task && a.date === dateStr
      );
      const staffNames = dayAssignments.map((a) => a.staffName).join(", ");
      row.push(staffNames || "—");
    });
    tableData.push(row);
  });

  autoTable(doc, {
    head: [["Task", ...DAYS.map((day, i) => `${day}\n${weekDates[i].getDate()}/${weekDates[i].getMonth() + 1}`)]],
    body: tableData,
    startY: 55,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 4,
      font: "helvetica",
    },
    headStyles: {
      fillColor: [33, 150, 243],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [245, 245, 245] },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
  });

  // Staff contact list
  const finalY = (doc as any).lastAutoTable.finalY || 120;
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Staff Contact List", 15, finalY + 15);

  const staffData = data.staff.map((s) => [
    s.name,
    s.trainedTasks.join(", "),
    s.restDays?.map(d => DAYS[Number(d)]).join(", ") || "None",
  ]);

  autoTable(doc, {
    head: [["Name", "Trained Tasks", "Regular Rest Days"]],
    body: staffData,
    startY: finalY + 20,
    theme: "striped",
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [100, 100, 100],
      textColor: 255,
      fontStyle: "bold",
    },
  });

  // Footer with generation timestamp
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Generated: ${new Date().toLocaleString("en-GB")} | Page ${i} of ${pageCount}`,
      15,
      200
    );
    doc.text("GIST Warehouse Rota System", 230, 200);
  }

  // Save
  const fileName = `staff-rota-${weekDates[0].toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}

export function generateManagerDutiesPDF(data: ManagerReportData): void {
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  const weekDates = DAYS.map((_, i) => {
    const date = new Date(data.weekStart);
    date.setDate(data.weekStart.getDate() + i);
    return date;
  });

  // Header with branding
  doc.setFillColor(139, 69, 19);
  doc.rect(0, 0, 297, 25, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("GIST MANAGER DUTIES", 15, 13);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Weekly Schedule", 15, 20);

  // Date range
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Week: ${weekDates[0].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - ${weekDates[6].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
    15,
    35
  );

  // Summary box
  doc.setFillColor(255, 248, 220);
  doc.roundedRect(200, 30, 82, 20, 2, 2, "F");
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Active Managers:", 205, 36);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(139, 69, 19);
  doc.text(`${data.managers.length}`, 205, 44);
  
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Shifts: ${data.assignments.length}`, 235, 36);
  doc.text(`Duties: ${DUTIES.length}`, 235, 42);

  // Duties table
  const tableData: string[][] = [];
  DUTIES.forEach((duty) => {
    const row: string[] = [duty];
    weekDates.forEach((date) => {
      const dateStr = date.toISOString().split("T")[0];
      const dayAssignments = data.assignments.filter(
        (a) => a.duty === duty && a.date === dateStr
      );
      const managerNames = dayAssignments.map((a) => a.managerName).join(", ");
      row.push(managerNames || "—");
    });
    tableData.push(row);
  });

  autoTable(doc, {
    head: [["Duty", ...DAYS.map((day, i) => `${day}\n${weekDates[i].getDate()}/${weekDates[i].getMonth() + 1}`)]],
    body: tableData,
    startY: 55,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 4,
      font: "helvetica",
    },
    headStyles: {
      fillColor: [139, 69, 19],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [245, 245, 245] },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
  });

  // Manager assignment summary
  const finalY = (doc as any).lastAutoTable.finalY || 120;
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Manager Assignment Summary", 15, finalY + 15);

  // Count assignments per manager
  const assignmentCounts = new Map<string, number>();
  data.assignments.forEach((a) => {
    assignmentCounts.set(a.managerName, (assignmentCounts.get(a.managerName) || 0) + 1);
  });

  const managerSummary = Array.from(assignmentCounts.entries()).map(([name, count]) => [
    name,
    `${count} shifts`,
    `${Math.round((count / 7) * 100)}% of week`,
  ]);

  autoTable(doc, {
    head: [["Manager", "Total Shifts", "Coverage"]],
    body: managerSummary,
    startY: finalY + 20,
    theme: "striped",
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [100, 100, 100],
      textColor: 255,
      fontStyle: "bold",
    },
  });

  // Notes section
  const notesY = (doc as any).lastAutoTable.finalY + 15;
  if (notesY < 180) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", 15, notesY);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(200, 200, 200);
    for (let i = 0; i < 3; i++) {
      doc.line(15, notesY + 7 + (i * 8), 280, notesY + 7 + (i * 8));
    }
  }

  // Footer with generation timestamp
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Generated: ${new Date().toLocaleString("en-GB")} | Page ${i} of ${pageCount}`,
      15,
      200
    );
    doc.text("GIST Warehouse Rota System", 230, 200);
  }

  // Save
  const fileName = `manager-duties-${weekDates[0].toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}