// dashboard.js
const DATA_URL = "https://raw.githubusercontent.com/Kareemsasi/Libnpdb-data/refs/heads/main/data.json";

let charts = {}; // To store chart instances

// Fetches data from the specified URL
async function fetchData() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) { // Check if the request was successful
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}. Please ensure the DATA_URL is correct and the file is accessible.`);
        }
        const data = await response.json();
        return data; // This should be an array of compound objects
    } catch (error) {
        console.error("Error fetching data:", error);
        // Display a user-friendly error message on the page
        const container = document.querySelector('.dashboard-container');
        if (container) {
            container.innerHTML = `<div class="text-red-600 text-center p-8" style="color: red; text-align: center; padding: 2rem;">
                                    <h2 class="text-2xl font-bold mb-4" style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">Error Fetching Data</h2>
                                    <p>${error.message}</p>
                                    <p>Please check the data source URL and your internet connection. Ensure the JSON file is correctly formatted and accessible.</p>
                                 </div>`;
        }
        throw error; // Re-throw to be caught by renderDashboard if needed, or to stop execution
    }
}

// Groups an array of objects by a specified key
function groupBy(array, key) {
    return array.reduce((result, item) => {
        const value = item[key] || "Unknown"; // Access item property directly
        result[value] = (result[value] || 0) + 1;
        return result;
    }, {});
}

// Gets unique values for a specified key from an array of objects
function getUnique(array, key) {
    // Filter out "Unknown" or empty values before creating the Set for a more accurate unique count.
    const validValues = array.map(item => item[key]).filter(value => value && value !== "Unknown");
    return Array.from(new Set(validValues));
}

// Processes data for the discovery timeline chart
function processTimeline(compounds) {
    const yearCounts = {};
    compounds.forEach(c => {
        // Match "Collection Date" from data.json
        const collectionDate = c["Collection Date"] || "";
        const yearMatch = collectionDate.match(/\b\d{4}\b/); // Extract the first 4-digit number as year
        const year = yearMatch ? yearMatch[0] : null;

        if (year && year !== "No-d") { // Basic validation for a 4-digit year
            yearCounts[year] = (yearCounts[year] || 0) + 1;
        }
    });
    // Sort years numerically
    const years = Object.keys(yearCounts).sort((a, b) => parseInt(a) - parseInt(b));
    return {
        labels: years,
        data: years.map(y => yearCounts[y])
    };
}

// Updates summary cards with data
function updateSummary(compounds) {
    document.getElementById("total-compounds").textContent = compounds.length;
    // Generate "last updated" on the client side as it's not in the source JSON
    const now = new Date();
    document.getElementById("last-updated").textContent = "Data loaded: " + now.toLocaleDateString() + " " + now.toLocaleTimeString();
    // Match exact keys from data.json
    document.getElementById("total-families").textContent = getUnique(compounds, "Family").length;
    // Changed to count unique compounds by "LibNPDB ID"
    document.getElementById("total-unique-compounds").textContent = getUnique(compounds, "LibNPDB ID").length;
}

// Draws all charts on the dashboard
function drawCharts(compounds) {
    // Destroy old charts if they exist to prevent duplicates on refresh
    Object.values(charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    charts = {}; // Reset charts object

    const chartContainerIds = {
        cityChart: { canvasId: "cityChart", title: "Compounds by City" },
        familyChart: { canvasId: "familyChart", title: "Compounds by Family" },
        classificationChart: { canvasId: "classificationChart", title: "Compounds by Classification" },
        timelineChart: { canvasId: "timelineChart", title: "Discovery Timeline" }
    };

    if (!compounds || compounds.length === 0) {
        console.warn("No compounds data to draw charts.");
        Object.values(chartContainerIds).forEach(chartInfo => {
            const canvas = document.getElementById(chartInfo.canvasId);
            if (canvas && canvas.parentElement) {
                const p = document.createElement('p');
                p.className = 'text-center text-gray-500 p-4'; // Basic styling
                p.style.textAlign = 'center';
                p.style.color = 'grey';
                p.style.padding = '1rem';
                p.textContent = "No data available for this chart.";
                const chartCard = canvas.closest('.chart-card');
                if (chartCard) {
                    const titleDiv = chartCard.querySelector('.chart-title') || document.createElement('div');
                    if (!chartCard.querySelector('.chart-title')) {
                        titleDiv.className = 'chart-title';
                        titleDiv.textContent = chartInfo.title;
                    }
                    chartCard.innerHTML = '';
                    chartCard.appendChild(titleDiv);
                    chartCard.appendChild(p);
                } else if (canvas.parentElement) {
                     canvas.parentElement.innerHTML = '';
                     canvas.parentElement.appendChild(p);
                }
            }
        });
        return;
    }

    function ensureCanvas(id, titleText) {
        let canvas = document.getElementById(id);
        const chartCard = document.getElementById(id)?.closest('.chart-card');

        if (!canvas || canvas.tagName !== 'CANVAS') {
            if (chartCard) {
                const titleElement = chartCard.querySelector('.chart-title') || document.createElement('div');
                if (!chartCard.querySelector('.chart-title')) {
                    titleElement.className = 'chart-title';
                    titleElement.textContent = titleText;
                }
                
                let chartAreaContainer = chartCard.querySelector('canvas')?.parentElement || chartCard.querySelector('p')?.parentElement;
                if (chartAreaContainer && chartAreaContainer !== chartCard) { 
                    chartAreaContainer.innerHTML = `<canvas id="${id}"></canvas>`;
                } else { 
                    const existingCanvas = chartCard.querySelector('canvas');
                    if (existingCanvas) existingCanvas.remove();
                    const existingP = chartCard.querySelector('p.text-center'); // Assuming this class for no-data message
                    if (existingP) existingP.remove();
                    
                    const newCanvasElement = document.createElement('canvas');
                    newCanvasElement.id = id;
                    // Insert canvas after the title if title exists, otherwise just append
                    const titleDiv = chartCard.querySelector('.chart-title');
                    if (titleDiv && titleDiv.nextSibling) {
                        chartCard.insertBefore(newCanvasElement, titleDiv.nextSibling);
                    } else if (titleDiv) {
                        chartCard.appendChild(newCanvasElement);
                    }
                     else { // If no title, just append
                        chartCard.innerHTML = ''; // Clear card if it was just a 'no data' p
                        chartCard.appendChild(titleElement); // Add title back
                        chartCard.appendChild(newCanvasElement);
                    }
                }
                canvas = document.getElementById(id);
            }
        }
        if (!canvas) {
            console.error(`Canvas element with id "${id}" could not be found or re-created.`);
        }
        return canvas;
    }

    const cityCanvas = ensureCanvas(chartContainerIds.cityChart.canvasId, chartContainerIds.cityChart.title);
    const familyCanvas = ensureCanvas(chartContainerIds.familyChart.canvasId, chartContainerIds.familyChart.title);
    const classificationCanvas = ensureCanvas(chartContainerIds.classificationChart.canvasId, chartContainerIds.classificationChart.title);
    const timelineCanvas = ensureCanvas(chartContainerIds.timelineChart.canvasId, chartContainerIds.timelineChart.title);

    if (!cityCanvas || !familyCanvas || !classificationCanvas || !timelineCanvas) {
        console.error("One or more chart canvas elements are still missing after attempting to re-create them.");
        return;
    }

    // Compounds by City: Use "Place"
    const cityData = groupBy(compounds, "Place");
    charts.cityChart = new Chart(cityCanvas, {
        type: "bar",
        data: {
            labels: Object.keys(cityData),
            datasets: [{ label: "Compounds", data: Object.values(cityData), backgroundColor: "#2c5ec5" }]
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } }, responsive: true, maintainAspectRatio: false }
    });

    // Compounds by Family: Use "Family"
    const familyData = groupBy(compounds, "Family");
    charts.familyChart = new Chart(familyCanvas, {
        type: "bar",
        data: {
            labels: Object.keys(familyData),
            datasets: [{ label: "Compounds", data: Object.values(familyData), backgroundColor: "#4a90e2" }]
        },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } }, responsive: true, maintainAspectRatio: false }
    });

    // Compounds by Classification: Use "Compound Class"
    const classData = groupBy(compounds, "Compound Class");
    charts.classificationChart = new Chart(classificationCanvas, {
        type: "pie",
        data: {
            labels: Object.keys(classData),
            datasets: [{ data: Object.values(classData), backgroundColor: ["#2c5ec5", "#4a90e2", "#50e3c2", "#f5a623", "#d0021b", "#b8e986", "#bd10e0", "#f8e71c", "#9013fe", "#f5a623", "#7ed321", "#417505", "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40"] }]
        },
        options: { plugins: { legend: { position: "bottom" } }, responsive: true, maintainAspectRatio: false }
    });

    // Discovery Timeline: Uses "Collection Date"
    const timelineData = processTimeline(compounds);
    charts.timelineChart = new Chart(timelineCanvas, {
        type: "line",
        data: {
            labels: timelineData.labels,
            datasets: [{ label: "Compounds discovered", data: timelineData.data, borderColor: "#2c5ec5", backgroundColor: "rgba(44,94,197,0.08)", fill: true, tension: 0.3 }]
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } }, responsive: true, maintainAspectRatio: false }
    });
}

// Fills the compound details table
function fillTable(compounds) {
    const tbody = document.querySelector("#compoundTable tbody");
    if (!tbody) {
        console.error("Compound table body not found.");
        return;
    }
    tbody.innerHTML = ""; // Clear previous data

    if (!compounds || compounds.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 7; // Span across all columns
        td.textContent = "No compound data available.";
        td.style.textAlign = "center";
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    // Sort by "Collection Date" (descending for recency)
    const sortedCompounds = [...compounds].sort((a, b) => {
        const dateAValue = a["Collection Date"] || "";
        const dateBValue = b["Collection Date"] || "";

        const isValidDate = (dateStr) => /^\d{4}/.test(dateStr) || /^\d{4}-\d{2}-\d{2}/.test(dateStr);
        const dateA = isValidDate(dateAValue) ? dateAValue : "0000";
        const dateB = isValidDate(dateBValue) ? dateBValue : "0000";

        return (dateB).localeCompare(dateA); // Descending
    });

    sortedCompounds.slice(0, 10).forEach(row => {
        const tr = document.createElement("tr");
        const otherNames = row["Other Names"];
        const otherNamesText = Array.isArray(otherNames) ? otherNames.join(", ") : (otherNames || "");

        tr.innerHTML = `
            <td>${row["Compound Name"] || ""}</td>
            <td>${otherNamesText}</td>
            <td>${row["Species Name"] || ""}</td>
            <td>${row["Family"] || ""}</td>
            <td>${row["Source Country"] || ""}</td>
            <td>${(row["Collection Date"] || "").slice(0, 4)}</td>
            <td>${row["PubChem CID"] || ""}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Main function to render the dashboard
async function renderDashboard() {
    try {
        const compoundsArray = await fetchData();

        if (!Array.isArray(compoundsArray) || compoundsArray.length === 0) {
            console.warn("Fetched data is empty or not an array of compounds.");
            document.getElementById("total-compounds").textContent = "0";
            document.getElementById("last-updated").textContent = "Data is empty or unavailable.";
            document.getElementById("total-families").textContent = "0";
            const uniqueCompoundsEl = document.getElementById("total-unique-compounds");
            if (uniqueCompoundsEl) uniqueCompoundsEl.textContent = "0";
            fillTable([]);
            drawCharts([]);
            return;
        }

        updateSummary(compoundsArray);
        drawCharts(compoundsArray);
        fillTable(compoundsArray);

    } catch (error) {
        console.error("Failed to render dashboard after fetching data:", error);
        const lastUpdatedDiv = document.getElementById("last-updated");
        if (lastUpdatedDiv && !document.querySelector('.dashboard-container > div[style*="color: red"]')) {
            lastUpdatedDiv.textContent = "Error rendering dashboard. Check console.";
        }
    }
}

// Initial render on window load
window.onload = renderDashboard;
