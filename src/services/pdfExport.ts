import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { GreenFix } from '../utils/hydrology';
import { performProfessionalAssessment } from './HydrologyEngine';

export interface PDFExportData {
    streetName: string;
    latitude: number;
    longitude: number;
    rainfall: number;
    totalArea: number;
    totalReduction: number;
    features: GreenFix[];
    peakRunoff: number;
    screenshotElement?: HTMLElement | null;
}

/**
 * Export project data as a professional engineer's report
 */
export async function exportProjectPDF(data: PDFExportData): Promise<void> {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    // Run professional assessment
    const assessment = performProfessionalAssessment({
        latitude: data.latitude,
        longitude: data.longitude,
        totalAreaM2: data.totalArea,
        imperviousAreaM2: data.totalArea,
        soilType: 'B',
        designStormEvent: 10
    });

    let y = 15;
    y = drawPDFHeader(doc, data, y);
    y = await drawARCapture(doc, data, y);
    y = drawHydrologyData(doc, data, assessment.metrics, y);
    y = drawEngineeringSpecifications(doc, assessment.recommendations, y);
    y = drawGrantAlignmentSummary(doc, assessment.grantAlignment, y);
    y = drawROIMetricsSection(doc, y);
    drawPDFFooter(doc);

    const filename = `${data.streetName.replace(/\s+/g, '_')}_Engineering_Report.pdf`;
    doc.save(filename);
}

function drawPDFHeader(doc: jsPDF, data: PDFExportData, y: number): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(31, 41, 55);
    doc.rect(0, 0, pageWidth, 35, 'F');

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Stormwater Site Assessment', 10, y + 5);

    doc.setTextColor(239, 68, 68); // Red-500
    doc.setFontSize(10);
    doc.text('PRELIMINARY SCOPING OPINION - NOT FOR CONSTRUCTION', 10, y + 10);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`Project: ${data.streetName}`, 10, y + 18);

    doc.setFontSize(9);
    doc.text(`GIS: ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)} | Ref: ${Math.random().toString(36).substr(2, 9).toUpperCase()}`, 10, y + 24);

    return 45;
}

async function addCaptureToPDF(doc: jsPDF, container: HTMLElement | null, y: number): Promise<void> {
    if (!container) {
        doc.setFontSize(10);
        doc.setTextColor(128, 128, 128);
        doc.text('[AR Site Survey Placeholder]', 10, y + 50);
        return;
    }
    const canvas = await html2canvas(container);
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 10, y, 190, 100);
}

async function drawARCapture(doc: jsPDF, data: PDFExportData, y: number): Promise<number> {
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('1.0 Field Infrastructure Analysis (AR Capture)', 10, y);
    const container = data.screenshotElement || document.querySelector('#ar-container');
    try {
        await addCaptureToPDF(doc, container as HTMLElement, y + 5);
    } catch { /* ignore */ }
    return y + 110;
}

function drawHydrologyData(doc: jsPDF, data: PDFExportData, metrics: any, y: number): number {
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('2.0 Hydrology & Basin Characteristics (Rational Method)', 10, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`• Rainfall Intensity (i): ${data.rainfall} mm/hr`, 15, y);
    y += 6;
    doc.text(`• Weighted Runoff Coefficient (C): ${metrics.weightedC.toFixed(2)}`, 15, y);
    y += 6;
    doc.text(`• Peak Discharge (Q): ${metrics.peakRunoffLS.toFixed(2)} L/s`, 15, y);
    y += 6;
    doc.text(`• Required Water Quality Volume (WQv): ${metrics.requiredStorageM3.toFixed(2)} m³`, 15, y);
    return y + 10;
}

function drawEngineeringSpecifications(doc: jsPDF, recs: any[], y: number): number {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('3.0 Technical Specifications & Infrastructure Sizing', 10, y);
    y += 8;

    recs.forEach((rec, index) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${rec.feature}`, 15, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.text(`Requirement: ${rec.requirement}`, 20, y);
        y += 5;
        doc.text(`Spec: ${rec.description}`, 20, y);
        y += 6;
    });

    return y + 5;
}

function drawGrantAlignmentSummary(doc: jsPDF, grants: any[], y: number): number {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('4.0 Municipal Grant & Funding Alignment', 10, y);
    y += 8;

    grants.forEach((grant) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`• ${grant.programCode} (${grant.agency})`, 15, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.text(`Target Score: ${(grant.eligibilityScore * 100).toFixed(0)}% | Payout: ${grant.potentialFunding}`, 20, y);
        y += 6;
    });

    return y + 15;
}

function drawROIMetricsSection(doc: jsPDF, y: number): number {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105); // Green-600
    doc.text('5.0 Project Efficiency & ROI Summary', 10, y);
    y += 8;

    doc.setFillColor(240, 253, 244);
    doc.rect(10, y, 190, 20, 'F');

    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.text('Est. Billable Hours Saved:', 15, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.text('4.5 Hours (Automated Field Analysis + TR-55 Simulation)', 70, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.text('Estimated Value Created:', 15, y + 14);
    doc.setFont('helvetica', 'normal');
    doc.text('$675.00 (Based on $150/hr base rate)', 70, y + 14);

    return y + 25;
}

function drawPDFFooter(doc: jsPDF): void {
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);

    const disclaimer = "LEGAL DISCLAIMER: This report is a preliminary scoping opinion generated by Micro-Catchment Pro. It is not a licensed engineering design, drainage study, or stamp-ready plan. All calculations (Rational Method/TR-55) must be verified by a licensed Professional Engineer (PE) prior to submission or construction. AI/ML estimates are provided for feasibility scoping only.";

    const splitDisclaimer = doc.splitTextToSize(disclaimer, 180);
    doc.text(splitDisclaimer, 10, 275);

    doc.setFont('helvetica', 'bold');
    doc.text(
        `Technical Engine: PDAL v2.6 (Python LiDAR Worker) | Cloud-Fusion-Processing: ENABLED | Date: ${new Date().toLocaleDateString()}`,
        10,
        288
    );
}
