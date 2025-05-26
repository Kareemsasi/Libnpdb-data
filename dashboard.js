const DATA_URL = "https://raw.githubusercontent.com/Kareemsasi/Libnpdb-data/refs/heads/main/data.json";

let charts = {};

async function fetchData() {
    const res = await fetch(DATA_URL);
    return await res.json();
}

function groupBy(array, key) {
    return array.reduce((result, item) => {
        const value = item[key] || "Unknown";
        result[value] = (result[value] || 0) + 1;
        return result;
    }, {});
}

function getUnique(array, key) {
    return Array.from(new Set(array.map(item => item[key] || "Unknown")));
}

function processTimeline(compounds) {
    const yearCounts = {};
    compounds.forEach(c => {
        const year = (c.date || "").slice(0,4);
        if (year) yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    const years = Object.keys(yearCounts).sort();
    return {
        labels: years,
        data: years.map(y => yearCounts[y])
    };
}

function updateSummary(compounds, lastUpdated) {
    document.getElementById("total-compounds").textContent = compounds.length;
    document.getElementById("last-updated").textContent = "Last updated: " + (lastUpdated || "-");
    document.getElementById("total-families").textContent = getUnique(compounds, "family").length;
    document.getElementById("total-countries").textContent = getUnique(compounds, "country").length;
}

function drawCharts(compounds) {
    // Destroy old charts if exist
    Object.values(charts).forEach(chart => chart.destroy());

    // Country
    const countryData = groupBy(compounds, "country");
    charts.country = new Chart(document.getElementById("countryChart"), {
        type: "bar",
        data: {
            labels: Object.keys(countryData),
            datasets: [{
                label: "Compounds",
                data: Object.values(countryData),
                backgroundColor: "#2c5ec5"
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } },
            responsive: true
        }
    });

    // Family
    const familyData = groupBy(compounds, "family");
    charts.family = new Chart(document.getElementById("familyChart"), {
        type: "bar",
        data: {
            labels: Object.keys(familyData),
            datasets: [{
                label: "Compounds",
                data: Object.values(familyData),
                backgroundColor: "#4a90e2"
            }]
        },
        options: {
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true } },
            responsive: true
        }
    });

    // Classification
    const classData = groupBy(compounds, "chemical_classification");
    charts.classification = new Chart(document.getElementById("classificationChart"), {
        type: "pie",
        data: {
            labels: Object.keys(classData),
            datasets: [{
                data: Object.values(classData),
                backgroundColor: [
                    "#2c5ec5", "#4a90e2", "#50e3c2", "#f5a623",
                    "#d0021b", "#b8e986", "#bd10e0", "#f8e71c"
                ]
            }]
        },
        options: {
            plugins: { legend: { position: "bottom" } },
            responsive: true
        }
    });

    // Timeline
    const timeline = processTimeline(compounds);
    charts.timeline = new Chart(document.getElementById("timelineChart"), {
        type: "line",
        data: {
            labels: timeline.labels,
            datasets: [{
                label: "Compounds discovered",
                data: timeline.data,
                borderColor: "#2c5ec5",
                backgroundColor: "rgba(44,94,197,0.08)",
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } },
            responsive: true
        }
    });
}

function fillTable(compounds) {
    const tbody = document.querySelector("#compoundTable tbody");
    tbody.innerHTML = "";
    // Show top 10 by recency (or total if less)
    const sorted = [...compounds].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    sorted.slice(0, 10).forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.compound_name || ""}</td>
            <td>${(row.other_names && row.other_names.join(", ")) || ""}</td>
            <td>${row.plant_name || ""}</td>
            <td>${row.family || ""}</td>
            <td>${row.country || ""}</td>
            <td>${row.date ? row.date.slice(0,4) : ""}</td>
            <td>${row.cid || ""}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function renderDashboard() {
    try {
        const data = await fetchData();
        const compounds = Array.isArray(data.compounds) ? data.compounds : [];
        updateSummary(compounds, data.last_updated);
        drawCharts(compounds);
        fillTable(compounds);
    } catch (e) {
        alert("Failed to load data: " + e.message);
    }
}

// Auto-refresh every 30 minutes
setInterval(renderDashboard, 30 * 60 * 1000);

window.onload = renderDashboard;
