import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { NavbarComponent } from '../../navbar/navbar.component';
import { FooterComponent } from '../../footer/footer.component';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule, FormsModule, NavbarComponent, FooterComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('usersRoleChart') usersRoleChartRef!: ElementRef;
  @ViewChild('userGrowthChart') userGrowthChartRef!: ElementRef;
  @ViewChild('contractsTypeChart') contractsTypeChartRef!: ElementRef;
  @ViewChild('contractsGrowthChart') contractsGrowthChartRef!: ElementRef;

  stats: any = {
    total_users: 0,
    admin_users: 0,
    regular_users: 0,
    terms_accepted_users: 0,
    total_contracts: 0,
    signed_contracts: 0,
    unsigned_contracts: 0,
    pending_contracts: 0
  };

  // Filter options
  dateRange: string = 'last12Months'; // Options: last30Days, last3Months, last6Months, last12Months, allTime

  isLoading = true;
  usersRoleChart: any;
  userGrowthChart: any;
  contractsTypeChart: any;
  contractsGrowthChart: any;

  // Chart colors for dark theme
  chartColors = {
    primary: '#7c3aed',      // --primary
    primaryLight: '#8b5cf6', // --primary-light
    primaryDark: '#6d28d9',  // --primary-dark
    success: '#22c55e',      // --success
    warning: '#f59e0b',      // --warning from amber-500
    error: '#ef4444',        // --error
    textWhite: '#ffffff',    // --text-white
    textGray: '#cccccc',     // --text-light-gray
    bgDark: '#1a1a1a',       // --bg-dark
    bgDarkLight: '#2a2a2a'   // --bg-dark-light
  };

  constructor(private adminService: AdminService) { }

  ngOnInit(): void {
    this.loadDashboardStats();
  }

  ngAfterViewInit(): void {
    // Charts will be initialized after data is loaded
  }

  loadDashboardStats(): void {
    this.isLoading = true;
    this.adminService.getDashboardStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.isLoading = false;

        // Initialize charts after data is loaded
        setTimeout(() => {
          this.initUsersRoleChart();
          this.initUserGrowthChart();
          this.initContractsTypeChart();
          this.initContractsGrowthChart();
        }, 100);
      },
      error: (error) => {
        console.error('Error loading dashboard stats:', error);
        this.isLoading = false;
      }
    });
  }

  // Filter data based on date range
  applyDateFilter(): void {
    this.refreshData();
  }

  initUsersRoleChart(): void {
    if (this.usersRoleChartRef && this.usersRoleChartRef.nativeElement) {
      const ctx = this.usersRoleChartRef.nativeElement.getContext('2d');

      this.usersRoleChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Admin Users', 'Regular Users'],
          datasets: [{
            data: [
              this.stats.admin_users || 0,
              this.stats.regular_users || 0
            ],
            backgroundColor: [this.chartColors.primary, this.chartColors.primaryLight],
            borderWidth: 1,
            borderColor: this.chartColors.bgDarkLight
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: this.chartColors.textWhite,
                font: {
                  size: 12
                }
              }
            },
            title: {
              display: true,
              text: 'User Roles Distribution',
              color: this.chartColors.textWhite,
              font: {
                size: 16,
                weight: 'bold'
              }
            }
          }
        }
      });
    }
  }



  initUserGrowthChart(): void {
    if (this.userGrowthChartRef && this.userGrowthChartRef.nativeElement) {
      const ctx = this.userGrowthChartRef.nativeElement.getContext('2d');

      // Process monthly data
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const userData = Array(12).fill(0);

      if (this.stats.users_per_month) {
        this.stats.users_per_month.forEach((item: any) => {
          userData[item.month - 1] = item.count;
        });
      }

      // Define chart data
      const chartData = {
        labels: months,
        datasets: [
          {
            label: 'New Users',
            data: userData,
            backgroundColor: this.chartColors.primary,
            borderColor: this.chartColors.primaryLight,
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      };

      // Create chart with type assertion to bypass type checking
      this.userGrowthChart = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: this.chartColors.textGray
              }
            },
            x: {
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: this.chartColors.textGray
              }
            }
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: this.chartColors.textWhite,
                font: {
                  size: 12
                }
              }
            },
            title: {
              display: true,
              text: 'Monthly User Growth',
              color: this.chartColors.textWhite,
              font: {
                size: 16,
                weight: 'bold'
              }
            }
          }
        } as any
      });
    }
  }

  initContractsTypeChart(): void {
    if (this.contractsTypeChartRef && this.contractsTypeChartRef.nativeElement) {
      const ctx = this.contractsTypeChartRef.nativeElement.getContext('2d');

      this.contractsTypeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Signed Contracts', 'Pending Contracts', 'Other Unsigned'],
          datasets: [{
            data: [
              this.stats.signed_contracts || 0,
              this.stats.pending_contracts || 0,
              (this.stats.unsigned_contracts - this.stats.pending_contracts) || 0
            ],
            backgroundColor: [
              this.chartColors.success,
              this.chartColors.warning,
              this.chartColors.primaryLight
            ],
            borderWidth: 1,
            borderColor: this.chartColors.bgDarkLight
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: this.chartColors.textWhite,
                font: {
                  size: 12
                }
              }
            },
            title: {
              display: true,
              text: 'Contract Status Distribution',
              color: this.chartColors.textWhite,
              font: {
                size: 16,
                weight: 'bold'
              }
            }
          }
        }
      });
    }
  }

  initContractsGrowthChart(): void {
    if (this.contractsGrowthChartRef && this.contractsGrowthChartRef.nativeElement) {
      const ctx = this.contractsGrowthChartRef.nativeElement.getContext('2d');

      // Process monthly data
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const signedData = Array(12).fill(0);
      const unsignedData = Array(12).fill(0);

      if (this.stats.signed_contracts_per_month) {
        this.stats.signed_contracts_per_month.forEach((item: any) => {
          signedData[item.month - 1] = item.count;
        });
      }

      if (this.stats.unsigned_contracts_per_month) {
        this.stats.unsigned_contracts_per_month.forEach((item: any) => {
          unsignedData[item.month - 1] = item.count;
        });
      }

      // Define chart data
      const chartData = {
        labels: months,
        datasets: [
          {
            label: 'Signed Contracts',
            data: signedData,
            backgroundColor: this.chartColors.success,
            borderColor: this.chartColors.success,
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Unsigned Contracts',
            data: unsignedData,
            backgroundColor: this.chartColors.warning,
            borderColor: this.chartColors.warning,
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      };

      // Create chart with type assertion to bypass type checking
      this.contractsGrowthChart = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              stacked: false,
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: this.chartColors.textGray
              }
            },
            x: {
              stacked: false,
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: this.chartColors.textGray
              }
            }
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: this.chartColors.textWhite,
                font: {
                  size: 12
                }
              }
            },
            title: {
              display: true,
              text: 'Monthly Contract Creation',
              color: this.chartColors.textWhite,
              font: {
                size: 16,
                weight: 'bold'
              }
            }
          }
        } as any
      });
    }
  }

  refreshData(): void {
    this.loadDashboardStats();
  }
}
