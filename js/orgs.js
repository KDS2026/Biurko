/**
 * Outreach tracker for local organizations invited to a "Przystanek Konstytucja" stop.
 */
const ORG_STATUSES = {
    do_zaproszenia: { label: 'Do zaproszenia', color: '#8a8494' },
    do_konsultacji: { label: 'Do konsultacji', color: '#cc8800' },
    zaproszono: { label: 'Zaproszono', color: '#0066cc' },
    odpowiedziala: { label: 'Odpowiedziała', color: '#7b2d8e' },
    potwierdzila: { label: 'Potwierdziła udział', color: '#008844' },
    odmowila: { label: 'Odmówiła', color: '#cc0000' },
};

const SEED_CAMPAIGN = 'Przystanek Tour de Konstytucja z Kinem Letnim – Ostrów Wielkopolski 2026';

const SEED_ORGS = [
    {
        id: 'org_seed_zhp',
        campaign: SEED_CAMPAIGN,
        name: 'Hufiec ZHP Ostrów Wielkopolski',
        role: 'Strefa dla dzieci i młodzieży (gry terenowe, animacje), wolontariusze do obsługi namiotów',
        contactName: 'hm. Izabela Potasznik (komendantka)',
        email: 'ostrow@zhp.wlkp.pl',
        phone: '509 317 752 / 62 736 55 84',
        status: 'do_zaproszenia',
        confidence: 'high',
        notes: '',
        updatedAt: 0,
    },
    {
        id: 'org_seed_outw',
        campaign: SEED_CAMPAIGN,
        name: 'Ostrowski Uniwersytet Trzeciego Wieku (OUTW)',
        role: 'Dotarcie do seniorów (grupa docelowa wydarzenia), ew. udział w dyskusji po filmie',
        contactName: '',
        email: 'info@outw.edu.pl',
        phone: '62 735 53 22',
        status: 'do_zaproszenia',
        confidence: 'high',
        notes: '',
        updatedAt: 0,
    },
    {
        id: 'org_seed_ock',
        campaign: SEED_CAMPAIGN,
        name: 'Ostrowskie Centrum Kultury (OCK)',
        role: 'Scena otwarta dla lokalnych artystów, wsparcie techniczne/promocyjne',
        contactName: '',
        email: 'dyrektor@ockostrow.pl',
        phone: '',
        status: 'do_zaproszenia',
        confidence: 'high',
        notes: 'Alternatywny kontakt: impresariat@ockostrow.pl (dział wydarzeń)',
        updatedAt: 0,
    },
    {
        id: 'org_seed_mdk',
        campaign: SEED_CAMPAIGN,
        name: 'Młodzieżowy Dom Kultury (MDK)',
        role: 'Zespoły dziecięce/młodzieżowe na scenę otwartą, strefa dla dzieci',
        contactName: '',
        email: 'mdk@mdkostrow.pl',
        phone: '',
        status: 'do_zaproszenia',
        confidence: 'high',
        notes: '',
        updatedAt: 0,
    },
    {
        id: 'org_seed_rada_kobiet',
        campaign: SEED_CAMPAIGN,
        name: 'Ostrowska Rada Kobiet (przez Biuro Inicjatyw i Konsultacji Społecznych UM)',
        role: 'Konsultacja miniwarsztatu o równości i niedyskryminacji',
        contactName: 'Milena Tacik',
        email: 'mtacik@ostrow-wielkopolski.um.gov.pl',
        phone: '62 58-22-505',
        status: 'do_zaproszenia',
        confidence: 'high',
        notes: '',
        updatedAt: 0,
    },
    {
        id: 'org_seed_centrum_wolontariatu',
        campaign: SEED_CAMPAIGN,
        name: 'Stowarzyszenie "Centrum Wolontariatu"',
        role: 'Wolontariusze do animacji namiotów warsztatowych, obsługa strefy NGO',
        contactName: 'Zarząd: I. Grzęda, M. Dąbrowski, D. Mackiewicz, M. Krzywda',
        email: '',
        phone: '',
        status: 'do_zaproszenia',
        confidence: 'low',
        notes: 'Adres: ul. Wrocławska 22 / ul. Limanowskiego 17, 63-400 Ostrów Wlkp. E-mail nieopublikowany — ustalić telefonicznie lub przez profil na ngo.pl.',
        updatedAt: 0,
    },
    {
        id: 'org_seed_nowy_ostrow',
        campaign: SEED_CAMPAIGN,
        name: 'Stowarzyszenie "Nowy Ostrów"',
        role: 'Wolontariusze, lokalne inicjatywy społeczne',
        contactName: 'Maciej Klósak (prezes)',
        email: '',
        phone: '',
        status: 'do_zaproszenia',
        confidence: 'low',
        notes: 'Adres: ul. Wrocławska 93, 63-400 Ostrów Wlkp. Kontakt przez FB „Nowy Ostrów – Wolontariat” lub telefonicznie.',
        updatedAt: 0,
    },
    {
        id: 'org_seed_spacer_protestacyjny',
        campaign: SEED_CAMPAIGN,
        name: 'Ostrowski Spacer Protestacyjny "Łańcuch Światła"',
        role: 'Do ustalenia — grupa obywatelska, potencjalna obecność/wsparcie promocyjne',
        contactName: '',
        email: '',
        phone: '',
        status: 'do_zaproszenia',
        confidence: 'low',
        notes: 'UWAGA: grupa aktywna w protestach o charakterze politycznym (m.in. ws. niezależności sądów, „Lex TVN”). Oferta zawiera zapis o apolityczności wydarzenia — świadoma decyzja o zaproszeniu mimo ryzyka dla rozliczenia dotacji. Kontakt: FB „OstrowscySpacerowicze”.',
        updatedAt: 0,
    },
];

function initOrgsPanel(storage) {
    const $ = (sel) => document.querySelector(sel);

    const panel = $('#orgs-panel');
    const listEl = $('#orgs-list');
    const campaignInput = $('#orgs-campaign');
    const editModal = $('#org-edit-modal');
    const editTitle = $('#org-edit-title');
    const nameInput = $('#org-input-name');
    const roleInput = $('#org-input-role');
    const contactInput = $('#org-input-contact');
    const statusInput = $('#org-input-status');
    const emailInput = $('#org-input-email');
    const phoneInput = $('#org-input-phone');
    const confidenceInput = $('#org-input-confidence');
    const notesInput = $('#org-input-notes');

    let editingId = null;

    statusInput.innerHTML = Object.entries(ORG_STATUSES)
        .map(([value, { label }]) => `<option value="${value}">${label}</option>`)
        .join('');

    campaignInput.value = SEED_CAMPAIGN;

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    async function seedIfEmpty() {
        const all = await storage.getAllOrgs();
        if (all.length === 0) {
            for (const org of SEED_ORGS) {
                await storage.saveOrg(org);
            }
        }
    }

    async function render() {
        const all = await storage.getAllOrgs();
        const campaign = campaignInput.value.trim();
        const orgs = (campaign ? all.filter((o) => o.campaign === campaign) : all)
            .sort((a, b) => a.name.localeCompare(b.name, 'pl'));

        if (orgs.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <p>Brak organizacji dla tej kampanii.<br>Dodaj pierwszą!</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = orgs.map((org) => {
            const statusInfo = ORG_STATUSES[org.status] || { label: org.status, color: '#999' };
            return `
                <div class="org-card" data-id="${org.id}">
                    <div class="org-card-main">
                        <div class="org-card-title-row">
                            <h4>${escapeHtml(org.name)}</h4>
                            <span class="org-badge" style="background:${statusInfo.color}">${statusInfo.label}</span>
                            ${org.confidence === 'low' ? '<span class="org-confidence-flag" title="Kontakt niezweryfikowany">⚠ kontakt niepewny</span>' : ''}
                        </div>
                        ${org.role ? `<div class="org-card-role">${escapeHtml(org.role)}</div>` : ''}
                        <div class="org-card-contact">
                            ${org.contactName ? `<span>${escapeHtml(org.contactName)}</span>` : ''}
                            ${org.email ? `<a href="mailto:${escapeHtml(org.email)}">${escapeHtml(org.email)}</a>` : ''}
                            ${org.phone ? `<span>${escapeHtml(org.phone)}</span>` : ''}
                        </div>
                        ${org.notes ? `<div class="org-card-notes">${escapeHtml(org.notes)}</div>` : ''}
                    </div>
                    <div class="org-card-actions">
                        <button class="btn-icon btn-edit-org" data-edit-id="${org.id}" title="Edytuj">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon btn-delete-org" data-delete-id="${org.id}" title="Usuń">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('.btn-edit-org').forEach((btn) => {
            btn.addEventListener('click', () => openEdit(btn.dataset.editId));
        });

        listEl.querySelectorAll('.btn-delete-org').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (confirm('Usunąć tę organizację z listy?')) {
                    await storage.deleteOrg(btn.dataset.deleteId);
                    await render();
                }
            });
        });
    }

    async function openEdit(id) {
        editingId = id || null;

        if (editingId) {
            const all = await storage.getAllOrgs();
            const org = all.find((o) => o.id === editingId);
            if (!org) return;
            editTitle.textContent = 'Edytuj organizację';
            nameInput.value = org.name || '';
            roleInput.value = org.role || '';
            contactInput.value = org.contactName || '';
            statusInput.value = org.status || 'do_zaproszenia';
            emailInput.value = org.email || '';
            phoneInput.value = org.phone || '';
            confidenceInput.value = org.confidence || 'high';
            notesInput.value = org.notes || '';
        } else {
            editTitle.textContent = 'Nowa organizacja';
            nameInput.value = '';
            roleInput.value = '';
            contactInput.value = '';
            statusInput.value = 'do_zaproszenia';
            emailInput.value = '';
            phoneInput.value = '';
            confidenceInput.value = 'high';
            notesInput.value = '';
        }

        editModal.classList.remove('hidden');
        nameInput.focus();
    }

    function closeEdit() {
        editModal.classList.add('hidden');
        editingId = null;
    }

    async function saveEdit() {
        const name = nameInput.value.trim();
        if (!name) {
            alert('Podaj nazwę organizacji.');
            return;
        }

        const org = {
            id: editingId || 'org_' + Date.now(),
            campaign: campaignInput.value.trim() || SEED_CAMPAIGN,
            name,
            role: roleInput.value.trim(),
            contactName: contactInput.value.trim(),
            status: statusInput.value,
            email: emailInput.value.trim(),
            phone: phoneInput.value.trim(),
            confidence: confidenceInput.value,
            notes: notesInput.value.trim(),
            updatedAt: Date.now(),
        };

        await storage.saveOrg(org);
        closeEdit();
        await render();
    }

    $('#btn-orgs').addEventListener('click', async () => {
        panel.classList.remove('hidden');
        await render();
    });

    $('#btn-close-orgs').addEventListener('click', () => {
        panel.classList.add('hidden');
    });

    $('#btn-add-org').addEventListener('click', () => openEdit(null));
    $('#btn-cancel-org').addEventListener('click', closeEdit);
    $('#btn-save-org').addEventListener('click', saveEdit);
    campaignInput.addEventListener('input', () => render());

    return { seedIfEmpty };
}
