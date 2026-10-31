class SocialContact extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <nav class="box-contact">
                <ul>
                    <li>
                        <a href="https://www.facebook.com/thdyqt" target="blank">
                            <i class="fa-brands fa-facebook"></i>
                        </a>
                    </li>
                    <li>
                        <a href="https://www.instagram.com/thdyqt" target="blank">
                            <i class="fa-brands fa-instagram"></i>
                        </a>
                    </li>
                    <li>
                        <a href="https://www.tiktok.com/@thdyqt" target="blank">
                            <i class="fa-brands fa-tiktok"></i>
                        </a>
                    </li>
                    <li>
                        <a href="https://www.youtube.com/@duyphan7401" target="blank">
                            <i class="fa-brands fa-youtube"></i>
                        </a>
                    </li>
                </ul>
            </nav>
        `;
    }
}

customElements.define('social-contact', SocialContact);

class Header extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <header class="header">
                <div class="inner-wrap">
                    <div class="inner-brand">
                        <img src="../images/Logo.png" alt="Logo">
                        <div class="inner-title">
                            <h1 data-i18n="brand.title">DUT Download Accelerator</h1>
                            <div data-i18n="brand.subtitle">PBL4 - Hệ thống tăng tốc tải về</div>
                        </div>
                    </div>
                    <div class="inner-button-list">
                        <button type="button" class="inner-button" id="btn-header-speed-limit" data-i18n-title="header.speed_limit_title" title="Giới hạn băng thông (Click để chỉnh)">
                            <i class="fa-solid fa-gauge-high"></i> <span id="header-speed-limit-label" data-i18n="header.speed_unlimited">Không giới hạn</span>
                        </button>
                        <button type="button" class="inner-button" id="btn-header-pause-all" data-header-action="pause-all" data-i18n-title="header.pause_all_title" title="Tạm dừng tất cả các tệp">
                            <i class="fa-solid fa-pause"></i> <span data-i18n="header.pause_all">Tạm dừng tất cả</span>
                        </button>
                        <button type="button" class="inner-button btn-resume-all" id="btn-header-resume-all" data-header-action="resume-all" data-i18n-title="header.resume_all_title" title="Tiếp tục tất cả các tệp">
                            <i class="fa-solid fa-play"></i> <span data-i18n="header.resume_all">Tiếp tục tất cả</span>
                        </button>
                        <button type="button" class="inner-button btn-warning" id="btn-header-cancel-all" data-header-action="cancel-all" data-i18n-title="header.cancel_all_title" title="Hủy tất cả các tệp đang tải">
                            <i class="fa-solid fa-ban"></i> <span data-i18n="header.cancel_all">Hủy tất cả</span>
                        </button>
                        <button type="button" class="inner-button btn-danger" id="btn-header-delete-all" data-header-action="delete-all" data-i18n-title="header.delete_all_title" title="Xóa tất cả các tác vụ khỏi danh sách">
                            <i class="fa-solid fa-trash"></i> <span data-i18n="header.delete_all">Xóa tất cả</span>
                        </button>
                        <button type="button" class="inner-button btn-icon" id="btn-header-settings" data-i18n-title="header.settings" title="Cài đặt hệ thống"><i class="fa-solid fa-gear"></i></button>
                        <button type="button" class="inner-button-menu" title="Menu"><i class="fa-solid fa-bars"></i></button>
                    </div>
                </div>
            </header>
        `;
        const langToggleBtn = this.querySelector('#btn-header-lang-toggle');
        if (langToggleBtn) {
            langToggleBtn.addEventListener('click', () => {
                const cur = (window.i18n && window.i18n.getLanguage) ? window.i18n.getLanguage() : 'vi';
                const next = cur === 'vi' ? 'en' : 'vi';
                if (window.setLanguage) {
                    window.setLanguage(next, true);
                }
            });
        }
        if (window.i18n && window.i18n.getLanguage) {
            window.setLanguage(window.i18n.getLanguage(), false);
        }
    }
}

customElements.define('app-header', Header);

class Sider extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <nav class="sider">
                <div class="inner-menu-title" data-i18n="sider.category_title">DANH MỤC</div>
                <ul class="inner-menu">
                    <li>
                        <a class="active" href="#" data-filter="home">
                            <i class="fa-solid fa-house"></i> <span data-i18n="sider.home">Trang chủ</span>
                        </a>
                    </li>
                    <li>
                        <a href="#" data-filter="all">
                            <i class="fa-solid fa-layer-group"></i> <span data-i18n="sider.all">Tất cả</span>
                        </a>
                    </li>
                    <li>
                        <a href="#" data-filter="downloading">
                            <i class="fa-solid fa-spinner"></i> <span data-i18n="sider.downloading">Đang tải</span>
                        </a>
                    </li>
                    <li>
                        <a href="#" data-filter="completed">
                            <i class="fa-solid fa-circle-check"></i> <span data-i18n="sider.completed">Đã hoàn thành</span>
                        </a>
                    </li>
                    <li>
                        <a href="#" data-filter="audio">
                            <i class="fa-solid fa-music"></i> <span data-i18n="sider.audio">Âm thanh</span>
                        </a>
                    </li>
                    <li>
                        <a href="#" data-filter="video">
                            <i class="fa-solid fa-video"></i> <span data-i18n="sider.video">Video</span>
                        </a>
                    </li>
                    <li>
                        <a href="#" data-filter="document">
                            <i class="fa-solid fa-file-zipper"></i> <span data-i18n="sider.document">Nén / Tài liệu</span>
                        </a>
                    </li>
                    <li class="menu-divider-item"></li>
                    <li>
                        <a href="#" data-filter="chart" class="menu-chart-link">
                            <i class="fa-solid fa-chart-line"></i> <span data-i18n="sider.chart">Giám sát tốc độ</span>
                        </a>
                    </li>
                    <li>
                        <a href="#" data-filter="device" class="menu-device-link">
                            <i class="fa-solid fa-laptop"></i> <span data-i18n="sider.device">Thông tin thiết bị</span>
                        </a>
                    </li>
                </ul>
            </nav>
            <div class="sider-overlay"></div>
        `;
        const langToggleBtn = this.querySelector('#btn-header-lang-toggle');
        if (langToggleBtn) {
            langToggleBtn.addEventListener('click', () => {
                const cur = (window.i18n && window.i18n.getLanguage) ? window.i18n.getLanguage() : 'vi';
                const next = cur === 'vi' ? 'en' : 'vi';
                if (window.setLanguage) {
                    window.setLanguage(next, true);
                }
            });
        }
        if (window.i18n && window.i18n.getLanguage) {
            window.setLanguage(window.i18n.getLanguage(), false);
        }
    }
}
customElements.define('app-sider', Sider);
