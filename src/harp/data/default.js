const dephault = {
    categories: {
        1: {
            type: 'L',
            name: 'H',
            enabled: true
        },
        // 2: {
        //     type: 'L',
        //     name: 'A',
        //     enabled: true
        // },
        3: {
            type: 'F',
            name: 'A',
            enabled: true
        },
        4: {
            type: 'L',
            name: 'R',
            enabled: true
        },
        5: {
            type: 'F',
            name: 'R',
            enabled: true
        },
        6: {
            type: 'L',
            name: 'P',
            enabled: true
        },
        7: {
            type: 'F',
            name: 'P',
            enabled: true
        }
    },
    options: {
        1: {
            categoryId: 1,
            name: 'R-R',
            enabled: true
        },
        2: {
            categoryId: 1,
            name: 'R-L',
            enabled: true
        },
        3: {
            categoryId: 1,
            name: 'L-R',
            enabled: true
        },
        4: {
            categoryId: 1,
            name: 'L-L',
            enabled: true
        },
        5: {
            categoryId: 1,
            name: 'Neutral',
            enabled: true
        },
        6: {
            categoryId: 1,
            name: 'R/L',
            enabled: true
        },
        7: {
            categoryId: 1,
            name: 'L/R',
            enabled: true
        },
        9: {
            categoryId: 3,
            name: 'Right Down',
            enabled: true
        },
        10: {
            categoryId: 3,
            name: 'Right Back',
            enabled: true
        },
        11: {
            categoryId: 4,
            name: '0.5R',
            enabled: true
        },
        12: {
            categoryId: 4,
            name: '0.5L',
            enabled: true
        },
        13: {
            categoryId: 4,
            name: '1R',
            enabled: true
        },
        14: {
            categoryId: 5,
            name: '0.5R',
            enabled: true
        },
        15: {
            categoryId: 5,
            name: '0.5L',
            enabled: true
        },
        16: {
            categoryId: 5,
            name: '1R',
            enabled: true
        },
        17: {
            categoryId: 5,
            name: '1L',
            enabled: true
        },
        18: {
            categoryId: 5,
            name: '1.5R',
            enabled: true
        },
        19: {
            categoryId: 5,
            name: '1.5L',
            enabled: true
        },
        20: {
            categoryId: 6,
            name: 'Front',
            enabled: true
        },
        21: {
            categoryId: 6,
            name: 'Front-Right',
            enabled: true
        },
        22: {
            categoryId: 6,
            name: 'Front-Left',
            enabled: true
        },
        23: {
            categoryId: 6,
            name: 'Right',
            enabled: true
        },
        24: {
            categoryId: 6,
            name: 'Left',
            enabled: true
        },
        25: {
            categoryId: 6,
            name: 'Behind',
            enabled: true
        },
        26: {
            categoryId: 7,
            name: 'Travel',
            enabled: true
        },
        28: {
            categoryId: 3,
            name: 'Left Down',
            enabled: true
        },
        29: {
            categoryId: 3,
            name: 'Left Back',
            enabled: true
        },
        30: {
            categoryId: 3,
            name: 'Left Neck',
            enabled: true
        },
        31: {
            categoryId: 3,
            name: 'Right Neck',
            enabled: true
        },
        32: {
            categoryId: 4,
            name: '1L',
            enabled: true
        },
    },
    timings: {
        1: {
            start: 1,
            end: 3,
            options: {
                1: {
                    enabled: true,
                    optional: false,
                    options: {
                        1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true
                    }
                },
                3: {
                    enabled: true,
                    options: {
                        9: true, 10: true, 28: true, 29: true, 30: true, 31: true
                    }
                },
                4: {
                    enabled: true,
                    options: {
                        11: true, 12: true, 13: true, 32: true
                    }
                },
                5: {
                    enabled: true,
                    options: {
                        14: true, 15: true, 16: true, 17: true, 18: true, 19: true
                    }
                },
                6: {
                    enabled: true,
                    options: {
                        20: true, 21: true, 22: true, 23: true, 24: true, 25: true
                    }
                },
                7: {
                    enabled: true,
                    options: {
                        26: true
                    }
                }
            }
        },
        2: {
            start: 5,
            end: 7,
            options: {
                1: {
                    enabled: true,
                    optional: false,
                    options: {
                        1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true
                    }
                },
                3: {
                    enabled: true,
                    options: {
                        9: true, 10: true, 28: true, 29: true, 30: true, 31: true
                    }
                },
                4: {
                    enabled: true,
                    options: {
                        11: true, 12: true, 13: true, 32: true
                    }
                },
                5: {
                    enabled: true,
                    options: {
                        14: true, 15: true, 16: true, 17: true, 18: true, 19: true
                    }
                },
                6: {
                    enabled: true,
                    options: {
                        20: true, 21: true, 22: true, 23: true, 24: true, 25: true
                    }
                },
                7: {
                    enabled: true,
                    options: {
                        26: true
                    }
                }
            }
        }
    }
};
  
export default dephault;
  