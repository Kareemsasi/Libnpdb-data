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
        throw error; // Re-throw to be caught by renderDashboard
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
    return Array.from(new Set(array.map(item => item[key] || "Unknown")));
}

// Processes data for the discovery timeline chart
function processTimeline(compounds) {
    const yearCounts = {};
    compounds.forEach(c => {
        // Match "Collection Date" from data.json
        const collectionDate = c["Collection Date"] || "";
        const year = collectionDate.slice(0, 4);
        // Basic validation for a 4-digit year, ignoring "No-da" from "No-date"
        if (year && /^\d{4}$/.test(year) && year !== "No-d") {
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
    document.getElementById("total-countries").textContent = getUnique(compounds, "Source Country").length;
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

    if (!compounds || compounds.length === 0) {
        console.warn("No compounds data to draw charts.");
        const chartIds = ["countryChart", "familyChart", "classificationChart", "timelineChart"];
        chartIds.forEach(id => {
            const canvas = document.getElementById(id);
            if (canvas && canvas.parentElement) {
                // Replace canvas with a message
                const p = document.createElement('p');
                p.className = 'text-center text-gray-500 p-4';
                p.textContent = "No data available for this chart.";
                canvas.parentElement.innerHTML = ''; // Clear existing canvas/message
                canvas.parentElement.appendChild(p);
            }
        });
        return;
    }
    
    // Re-create canvas elements if they were replaced by "No data" messages
    function ensureCanvas(id) {
        let canvas = document.getElementById(id);
        if (!canvas || canvas.tagName !== 'CANVAS') {
            const parent = document.querySelector(`.chart-card canvas[id="${id}"]`)?.parentElement || document.querySelector(`.chart-card div[data-chart-id="${id}"]`);
            if (parent) {
                parent.innerHTML = `<canvas id="${id}"></canvas>`;
                canvas = document.getElementById(id);
            }
        }
        if (!canvas) {
            console.error(`Canvas element with id "${id}" could not be found or re-created.`);
        }
        return canvas;
    }

    const countryCanvas = ensureCanvas("countryChart");
    const familyCanvas = ensureCanvas("familyChart");
    const classificationCanvas = ensureCanvas("classificationChart");
    const timelineCanvas = ensureCanvas("timelineChart");

    if (!countryCanvas || !familyCanvas || !classificationCanvas || !timelineCanvas) {
        console.error("One or more chart canvas elements are still missing after attempting to re-create them.");
        return;
    }

    // Compounds by Country: Use "Source Country"
    const countryData = groupBy(compounds, "Source Country");
    charts.country = new Chart(countryCanvas, {
        type: "bar",
        data: {
            labels: Object.keys(countryData),
            datasets: [{ label: "Compounds", data: Object.values(countryData), backgroundColor: "#2c5ec5" }]
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } }, responsive: true, maintainAspectRatio: false }
    });

    // Compounds by Family: Use "Family"
    const familyData = groupBy(compounds, "Family");
    charts.family = new Chart(familyCanvas, {
        type: "bar",
        data: {
            labels: Object.keys(familyData),
            datasets: [{ label: "Compounds", data: Object.values(familyData), backgroundColor: "#4a90e2" }]
        },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } }, responsive: true, maintainAspectRatio: false }
    });

    // Compounds by Classification: Use "Compound Class"
    const classData = groupBy(compounds, "Compound Class");
    charts.classification = new Chart(classificationCanvas, {
        type: "pie",
        data: {
            labels: Object.keys(classData),
            datasets: [{ data: Object.values(classData), backgroundColor: ["#2c5ec5", "#4a90e2", "#50e3c2", "#f5a623", "#d0021b", "#b8e986", "#bd10e0", "#f8e71c", "#9013fe", "#f5a623", "#7ed321", "#417505", "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40"] }] // Added more colors
        },
        options: { plugins: { legend: { position: "bottom" } }, responsive: true, maintainAspectRatio: false }
    });

    // Discovery Timeline: Uses "Collection Date"
    const timelineData = processTimeline(compounds);
    charts.timeline = new Chart(timelineCanvas, {
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

        // Treat "No-date" or invalid dates as oldest for sorting
        const isValidDate = (dateStr) => /^\d{4}/.test(dateStr) || /^\d{4}-\d{2}-\d{2}/.test(dateStr);
        const dateA = isValidDate(dateAValue) ? dateAValue : "0000";
        const dateB = isValidDate(dateBValue) ? dateBValue : "0000";
        
        return (dateB).localeCompare(dateA); // Descending
    });

    sortedCompounds.slice(0, 10).forEach(row => {
        const tr = document.createElement("tr");
        // Match exact keys from data.json
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
        const compoundsArray = await fetchData(); // Fetched data is the array of compounds

        if (!Array.isArray(compoundsArray) || compoundsArray.length === 0) {
            console.warn("Fetched data is empty or not an array of compounds.");
            document.getElementById("total-compounds").textContent = "0";
            document.getElementById("last-updated").textContent = "Data is empty or unavailable.";
            document.getElementById("total-families").textContent = "0";
            document.getElementById("total-countries").textContent = "0";
            fillTable([]); // Ensure table shows "no data" message
            drawCharts([]); // Ensure charts show "no data" message
            return;
        }

        updateSummary(compoundsArray);
        drawCharts(compoundsArray);
        fillTable(compoundsArray);

    } catch (error) {
        console.error("Failed to load or render dashboard:", error);
        const container = document.querySelector('.dashboard-container');
        if (container) {
            // Clear existing content and show error
            container.innerHTML = `<div class="text-red-600 text-center p-8">
                                    <h2 class="text-2xl font-bold mb-4">Error Loading Dashboard</h2>
                                    <p>${error.message}</p>
                                    <p>Please check the data source and network connection. More details might be available in the browser console (usually F12).</p>
                                 </div>`;
        } else {
            // Fallback if container is not found
            document.body.innerHTML = `<p style="color: red; text-align: center;">Critical error: Dashboard container not found. ${error.message}</p>`;
        }
    }
}

// Auto-refresh (Consider implications: API rate limits, server load)
// setInterval(renderDashboard, 30 * 60 * 1000); // e.g., every 30 minutes

// Initial render on window load
window.onload = renderDashboard;
