"use strict";
(() => {
var exports = {};
exports.id = 375;
exports.ids = [375];
exports.modules = {

/***/ 7147:
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ 1017:
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ 8932:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ handler)
/* harmony export */ });
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(7147);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1017);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_1__);


async function handler(req, res) {
    const { slug } = req.query;
    try {
        // Mappez les slugs vers des fichiers JSON. Ici, exemple pour sante-taouk.
        const map = {
            "sante-taouk": path__WEBPACK_IMPORTED_MODULE_1___default().join(process.cwd(), "data", "items-sante-taouk.json")
        };
        const filePath = map[slug];
        if (!filePath) {
            return res.status(404).json({
                error: "Restaurant introuvable"
            });
        }
        const file = await fs__WEBPACK_IMPORTED_MODULE_0__.promises.readFile(filePath, "utf8");
        const data = JSON.parse(file);
        return res.status(200).json({
            items: data
        });
    } catch (err) {
        console.error("API items error:", err);
        return res.status(500).json({
            error: "Impossible de charger les items"
        });
    }
}


/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-api-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = (__webpack_exec__(8932));
module.exports = __webpack_exports__;

})();