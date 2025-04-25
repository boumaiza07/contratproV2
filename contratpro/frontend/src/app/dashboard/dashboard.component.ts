import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { Chart, ChartConfiguration, ChartOptions, registerables, ChartTypeRegistry } from 'chart.js';
import { Router } from '@angular/router';
import { Subject, forkJoin, of, throwError } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';

// Register all Chart.js components
Chart.register(...registerables);
import { NavbarComponent } from "../navbar/navbar.component";
import { FooterComponent } from "../footer/footer.component";
import { CommonModule } from '@angular/common';
import { SignedContractService } from '../services/signed-contract.service';
import { UnsignedContractService } from '../services/unsigned-contract.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  imports: [NavbarComponent, FooterComponent, CommonModule],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('activityChart') activityChartRef!: ElementRef;
  @ViewChild('completionChart') completionChartRef!: ElementRef;

  currentDate = new Date();
  activityChart: Chart | null = null;
  completionChart: Chart | null = null;

  // Loading state
  isLoading = false;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;

  // Sorting
  sortField: string = 'id';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Selected contract for details
  selectedContract: any = null;

  // Destroy subject for unsubscribing
  private destroy$ = new Subject<void>();

  metrics = {
    active: 0,
    signed: 0,
    unsigned: 0,
    total: 0
  };

  contracts: any[] = [];
  signedContracts: any[] = [];
  unsignedContracts: any[] = [];
  filteredContracts: any[] = [];

  activeTab: 'all' | 'signed' | 'unsigned' = 'all';

  // Dark theme chart colors
  chartColors = {
    primary: '#7c3aed',      // --primary
    primaryLight: '#8b5cf6', // --primary-light
    primaryDark: '#6d28d9',  // --primary-dark
    error: '#ef4444',        // --error
    success: '#22c55e',      // --success
    textWhite: '#ffffff',    // --text-white
    textGray: '#cccccc'      // --text-light-gray
  };

  // Math object for template use
  Math = Math;

  constructor(
    private signedContractService: SignedContractService,
    private unsignedContractService: UnsignedContractService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.setCurrentDate();
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    // Initialize charts after view is initialized
    // Use a timeout to ensure the DOM is fully rendered
    setTimeout(() => {
      this.initCharts();
    }, 300);
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();

    // Clean up charts
    if (this.activityChart) {
      this.activityChart.destroy();
    }
    if (this.completionChart) {
      this.completionChart.destroy();
    }
  }

  private setCurrentDate(): void {
    this.currentDate = new Date();
  }

  loadDashboardData(): void {
    console.log('Loading dashboard data...');
    this.isLoading = true;

    // Load signed contracts
    this.signedContractService.getSignedContracts()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error fetching signed contracts:', error);
          return of({ data: [] });
        }),
        finalize(() => {
          // This will run after the observable completes or errors
          if (!this.unsignedContracts.length) {
            this.isLoading = false;
          }
        })
      )
      .subscribe(data => {
        console.log('Signed contracts response:', data);

        // Handle different response formats
        if (data && data.data) {
          this.signedContracts = data.data;
        } else if (Array.isArray(data)) {
          this.signedContracts = data;
        } else if (data && data.current_page) {
          // Laravel pagination format
          this.signedContracts = data.data || [];
        } else {
          this.signedContracts = [];
        }

        console.log('Processed signed contracts:', this.signedContracts);
        this.loadUnsignedContracts();
      });
  }

  loadUnsignedContracts(): void {
    // Load unsigned contracts
    this.unsignedContractService.getUnsignedContracts()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error fetching unsigned contracts:', error);
          return of({ data: [] });
        }),
        finalize(() => {
          this.isLoading = false;
          this.processContractData();
        })
      )
      .subscribe(data => {
        console.log('Unsigned contracts response:', data);

        // Handle different response formats
        if (data && data.data) {
          this.unsignedContracts = data.data;
        } else if (Array.isArray(data)) {
          this.unsignedContracts = data;
        } else if (data && data.current_page) {
          // Laravel pagination format
          this.unsignedContracts = data.data || [];
        } else {
          this.unsignedContracts = [];
        }

        console.log('Processed unsigned contracts:', this.unsignedContracts);
      });
  }

  processContractData(): void {
    // Combine all contracts for the 'all' tab
    this.contracts = [
      ...this.signedContracts.map(contract => ({
        ...contract,
        type: 'signed',
        status: 'signed',
        client: contract.nom_contrat || 'Unnamed Contract',
        startDate: new Date(contract.created_at),
        progress: 100
      })),
      ...this.unsignedContracts.map(contract => ({
        ...contract,
        type: 'unsigned',
        status: contract.status || 'pending',
        client: contract.nom_contrat || 'Unnamed Contract',
        startDate: new Date(contract.created_at),
        progress: 50
      }))
    ];

    console.log('Combined contracts:', this.contracts);

    // Sort contracts based on current sort settings
    this.sortContracts();

    // Update filtered contracts based on active tab
    this.updateFilteredContracts();
    console.log('Filtered contracts:', this.filteredContracts);

    // Calculate metrics
    this.calculateMetrics();
    console.log('Metrics:', this.metrics);

    // Update charts
    this.updateCharts();
  }

  calculateMetrics(): void {
    this.metrics.signed = this.signedContracts.length;
    this.metrics.unsigned = this.unsignedContracts.length;
    this.metrics.active = this.unsignedContracts.filter(c => c.status === 'pending').length;
    this.metrics.total = this.contracts.length;
  }

  updateFilteredContracts(): void {
    switch (this.activeTab) {
      case 'signed':
        this.filteredContracts = this.signedContracts.map(contract => ({
          ...contract,
          type: 'signed',
          status: 'signed',
          client: contract.nom_contrat,
          startDate: new Date(contract.created_at),
          progress: 100
        }));
        break;
      case 'unsigned':
        this.filteredContracts = this.unsignedContracts.map(contract => ({
          ...contract,
          type: 'unsigned',
          status: contract.status || 'pending',
          client: contract.nom_contrat,
          startDate: new Date(contract.created_at),
          progress: 50
        }));
        break;
      default: // 'all'
        this.filteredContracts = [...this.contracts];
        break;
    }
  }



  searchContracts(event: Event): void {
    const searchTerm = (event.target as HTMLInputElement).value.toLowerCase();

    // Filter based on the active tab
    const contractsToFilter = this.activeTab === 'all' ? this.contracts :
                             this.activeTab === 'signed' ? this.signedContracts :
                             this.unsignedContracts;

    // Apply the filter
    const filtered = contractsToFilter.filter(contract =>
      contract.id.toString().includes(searchTerm) ||
      (contract.nom_contrat && contract.nom_contrat.toLowerCase().includes(searchTerm)) ||
      (contract.email_signataire && contract.email_signataire.toLowerCase().includes(searchTerm)) ||
      (contract.status && contract.status.toLowerCase().includes(searchTerm))
    );

    // Update filtered contracts with the correct format
    this.updateFilteredContractsFromArray(filtered);
  }

  updateFilteredContractsFromArray(contracts: any[]): void {
    if (this.activeTab === 'signed') {
      this.filteredContracts = contracts.map(contract => ({
        ...contract,
        type: 'signed',
        status: 'signed',
        client: contract.nom_contrat,
        startDate: new Date(contract.created_at),
        progress: 100
      }));
    } else if (this.activeTab === 'unsigned') {
      this.filteredContracts = contracts.map(contract => ({
        ...contract,
        type: 'unsigned',
        status: contract.status || 'pending',
        client: contract.nom_contrat,
        startDate: new Date(contract.created_at),
        progress: 50
      }));
    } else {
      // For 'all' tab, we need to determine the type for each contract
      this.filteredContracts = contracts.map(contract => {
        const isSignedContract = this.signedContracts.some(sc => sc.id === contract.id);
        return {
          ...contract,
          type: isSignedContract ? 'signed' : 'unsigned',
          status: isSignedContract ? 'signed' : (contract.status || 'pending'),
          client: contract.nom_contrat,
          startDate: new Date(contract.created_at),
          progress: isSignedContract ? 100 : 50
        };
      });
    }
  }

  setActiveTab(tab: 'all' | 'signed' | 'unsigned'): void {
    this.activeTab = tab;
    this.updateFilteredContracts();
  }

  addNewContract(): void {
    // Redirect to the file upload page
    console.log('Redirecting to file upload page...');
    window.location.href = '/fileupload';
  }

  initCharts(): void {
    this.initActivityChart();
    this.initCompletionChart();
  }

  updateCharts(): void {
    console.log('Updating charts with metrics:', this.metrics);

    // If charts aren't initialized yet, initialize them
    if (!this.activityChart && !this.completionChart &&
        this.activityChartRef?.nativeElement && this.completionChartRef?.nativeElement) {
      this.initCharts();
      return;
    }

    // Update activity chart if it exists
    if (this.activityChart) {
      const activityData = this.getActivityData();
      console.log('Activity chart data:', activityData);

      // Update both datasets
      this.activityChart.data.datasets[0].data = activityData.signed;
      this.activityChart.data.datasets[1].data = activityData.unsigned;

      // @ts-ignore - TypeScript doesn't recognize the 'none' mode but it's valid
      this.activityChart.update('none'); // Use 'none' animation mode for smoother updates
    } else {
      console.warn('Activity chart not initialized');
    }

    // Update completion chart if it exists
    if (this.completionChart) {
      // Prepare data for the chart
      const chartData = [
        this.metrics.signed || 0,
        this.metrics.unsigned || 0,
        this.metrics.active || 0
      ];

      console.log('Completion chart data:', chartData);

      // Update chart data
      this.completionChart.data.datasets[0].data = chartData;

      // Update chart colors
      this.completionChart.data.datasets[0].backgroundColor = [
        'rgba(16, 185, 129, 0.7)', // Signed - Green
        'rgba(59, 130, 246, 0.7)',  // Unsigned - Blue
        'rgba(245, 158, 11, 0.7)'   // Pending - Orange
      ];

      this.completionChart.data.datasets[0].borderColor = [
        'rgba(16, 185, 129, 1)', // Signed - Green
        'rgba(59, 130, 246, 1)',  // Unsigned - Blue
        'rgba(245, 158, 11, 1)'   // Pending - Orange
      ];

      // Apply updates
      // @ts-ignore - TypeScript doesn't recognize the 'none' mode but it's valid
      this.completionChart.update('none'); // Use 'none' animation mode for smoother updates
    } else {
      console.warn('Completion chart not initialized');
    }
  }

  getActivityData(): { signed: number[], unsigned: number[] } {
    // This would typically come from the API based on the selected period
    const labels = this.getLabelsForPeriod();

    // For demonstration, generate data based on the total number of contracts
    // with some randomness to make it look realistic
    const baseSignedValue = Math.max(1, Math.floor(this.metrics.signed / labels.length));
    const baseUnsignedValue = Math.max(1, Math.floor(this.metrics.unsigned / labels.length));

    // Generate data with a slight upward trend and some randomness
    const signedData = labels.map((_, index) => {
      // Add a slight upward trend
      const trendFactor = 1 + (index * 0.08);
      // Add some randomness (±30%)
      const randomFactor = 0.7 + (Math.random() * 0.6);
      // Calculate the value
      return Math.max(1, Math.floor(baseSignedValue * trendFactor * randomFactor));
    });

    const unsignedData = labels.map((_, index) => {
      // Add a different trend for unsigned contracts
      const trendFactor = 1 + (index * 0.05);
      // Add some randomness (±30%)
      const randomFactor = 0.7 + (Math.random() * 0.6);
      // Calculate the value
      return Math.max(1, Math.floor(baseUnsignedValue * trendFactor * randomFactor));
    });

    return { signed: signedData, unsigned: unsignedData };
  }

  getLabelsForPeriod(): string[] {
    // Default to month view
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  }

  initActivityChart(): void {
    if (!this.activityChartRef?.nativeElement) {
      console.warn('Activity chart reference not available');
      return;
    }

    try {
      // Get the canvas context
      const ctx = this.activityChartRef.nativeElement.getContext('2d');
      if (!ctx) {
        console.error('Could not get 2D context for activity chart');
        return;
      }

      // Get labels for the selected period
      const labels = this.getLabelsForPeriod();
      console.log('Activity chart labels:', labels);

      // Get activity data
      const activityData = this.getActivityData();

      // Prepare chart data with multiple datasets for a more modern look
      const data = {
        labels: labels,
        datasets: [
          {
            label: 'Signed Contracts',
            data: activityData.signed,
            backgroundColor: 'rgba(16, 185, 129, 0.2)', // Green with transparency
            borderColor: 'rgba(16, 185, 129, 1)',       // Solid green
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(16, 185, 129, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: 'rgba(16, 185, 129, 1)',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            order: 1
          },
          {
            label: 'Unsigned Contracts',
            data: activityData.unsigned,
            backgroundColor: 'rgba(59, 130, 246, 0.2)', // Blue with transparency
            borderColor: 'rgba(59, 130, 246, 1)',       // Solid blue
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(59, 130, 246, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: 'rgba(59, 130, 246, 1)',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            order: 2
          }
        ]
      };

      // Chart configuration with proper type annotation
      const config: ChartConfiguration<'line'> = {
        type: 'line',
        data: data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(200, 200, 200, 0.2)'
              },
              ticks: {
                color: 'rgba(100, 116, 139, 0.8)',
                padding: 10,
                font: {
                  size: 11
                }
              },
              title: {
                display: true,
                text: 'Number of Contracts',
                color: 'rgba(100, 116, 139, 0.8)',
                font: {
                  size: 12,
                  weight: 500
                },
                padding: {
                  bottom: 10
                }
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: 'rgba(100, 116, 139, 0.8)',
                padding: 10,
                font: {
                  size: 11
                }
              }
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              align: 'end',
              labels: {
                boxWidth: 12,
                padding: 15,
                usePointStyle: true,
                pointStyle: 'circle',
                font: {
                  size: 12
                }
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: 12,
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              displayColors: true,
              boxWidth: 8,
              boxHeight: 8,
              usePointStyle: true,
              cornerRadius: 6,
              callbacks: {
                title: function(tooltipItems) {
                  return tooltipItems[0].label;
                },
                label: function(context) {
                  return ` ${context.dataset.label}: ${context.parsed.y} contracts`;
                }
              }
            }
          }
        }
      };

      // Create the chart
      this.activityChart = new Chart(ctx, config);
      console.log('Activity chart initialized');
    } catch (error) {
      console.error('Error initializing activity chart:', error);
    }
  }

  initCompletionChart(): void {
    if (!this.completionChartRef?.nativeElement) {
      console.warn('Completion chart reference not available');
      return;
    }

    try {
      // Get the canvas context
      const ctx = this.completionChartRef.nativeElement.getContext('2d');
      if (!ctx) {
        console.error('Could not get 2D context for completion chart');
        return;
      }

      // Ensure metrics have valid values
      const signedCount = this.metrics.signed || 0;
      const unsignedCount = this.metrics.unsigned || 0;
      const activeCount = this.metrics.active || 0;

      console.log('Completion chart initial data:', { signed: signedCount, unsigned: unsignedCount, active: activeCount });

      // Prepare chart data
      const data = {
        labels: ['Signed', 'Unsigned', 'Pending'],
        datasets: [{
          label: 'Contract Status',
          data: [signedCount, unsignedCount, activeCount],
          backgroundColor: [
            'rgba(16, 185, 129, 0.7)', // Signed - Green
            'rgba(59, 130, 246, 0.7)',  // Unsigned - Blue
            'rgba(245, 158, 11, 0.7)'   // Pending - Orange
          ],
          borderColor: [
            'rgba(16, 185, 129, 1)', // Signed - Green
            'rgba(59, 130, 246, 1)',  // Unsigned - Blue
            'rgba(245, 158, 11, 1)'   // Pending - Orange
          ],
          borderWidth: 1,
          hoverOffset: 4
        }]
      };

      // Chart configuration
      const config: ChartConfiguration<'doughnut'> = {
        type: 'doughnut',
        data: data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          // Use the correct property for doughnut chart cutout percentage
          // @ts-ignore - TypeScript doesn't recognize this property but it's valid for doughnut charts
          cutout: '70%',
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 12,
                padding: 15,
                font: {
                  size: 12
                },
                color: 'rgba(100, 116, 139, 0.8)'
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: 10,
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: 'rgba(200, 200, 200, 0.25)',
              borderWidth: 1,
            }
          },
        }
      };

      // Create the chart
      this.completionChart = new Chart(ctx, config);
      console.log('Completion chart initialized');
    } catch (error) {
      console.error('Error initializing completion chart:', error);
    }
  }



  /**
   * Sort contracts based on current sort field and direction
   */
  sortContracts(): void {
    this.contracts.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      // Handle different sort fields
      switch (this.sortField) {
        case 'id':
          valueA = a.id;
          valueB = b.id;
          break;
        case 'client':
          valueA = a.client || a.nom_contrat || '';
          valueB = b.client || b.nom_contrat || '';
          break;
        case 'date':
          valueA = new Date(a.created_at || a.startDate).getTime();
          valueB = new Date(b.created_at || b.startDate).getTime();
          break;
        case 'status':
          valueA = a.status || '';
          valueB = b.status || '';
          break;
        case 'type':
          valueA = a.type || '';
          valueB = b.type || '';
          break;
        default:
          valueA = a.id;
          valueB = b.id;
      }

      // Compare values based on sort direction
      if (this.sortDirection === 'asc') {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });
  }

  /**
   * Change sort field or direction
   */
  setSortField(field: string): void {
    if (this.sortField === field) {
      // Toggle direction if clicking the same field
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Set new field and default to descending
      this.sortField = field;
      this.sortDirection = 'desc';
    }

    // Re-sort the data
    this.sortContracts();
    this.updateFilteredContracts();
  }

  /**
   * View contract details
   */
  viewContractDetails(contract: any): void {
    this.selectedContract = contract;
  }

  /**
   * Close contract details modal
   */
  closeContractDetails(): void {
    this.selectedContract = null;
  }

  /**
   * Download contract
   */
  downloadContract(contract: any): void {
    this.isLoading = true;

    // Get the service based on contract type
    const service = contract.type === 'signed'
      ? this.signedContractService.downloadSignedContract(contract.id)
      : this.unsignedContractService.downloadUnsignedContract(contract.id);

    service.pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: (blob: Blob) => {
        // Determine file extension based on MIME type
        let fileExtension = '.pdf'; // Default extension

        if (blob.type) {
          // Map common MIME types to extensions - only PDF and Word
          const mimeToExtension: Record<string, string> = {
            'application/pdf': '.pdf',
            'application/msword': '.doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
          };

          // Use the mapped extension or keep default
          fileExtension = mimeToExtension[blob.type] || fileExtension;
          console.log('File MIME type:', blob.type, 'Extension:', fileExtension);
        }

        // Create a name for the file using contract info and the appropriate extension
        const fileName = `${contract.client || contract.nom_contrat || 'contract'}${fileExtension}`;

        // Create a download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        // Clean up
        window.URL.revokeObjectURL(url);
        a.remove();

        console.log('Contract downloaded successfully:', fileName);
      },
      error: (error) => {
        console.error('Error downloading contract:', error);
        alert('Failed to download contract. Please try again.');
      }
    });
  }

  /**
   * Sign unsigned contract
   * Redirects to the security page with the contract ID as a query parameter
   */
  signContract(contract: any): void {
    if (contract.type !== 'unsigned') {
      console.error('Cannot sign a contract that is not unsigned');
      return;
    }

    console.log('Redirecting to sign contract:', contract.id);
    this.router.navigate(['/security'], {
      queryParams: { unsignedContractId: contract.id }
    });
  }

  /**
   * Export contracts data to CSV
   */
  exportToCSV(): void {
    // Get the contracts based on active tab
    const contractsToExport = this.activeTab === 'all' ? this.contracts :
                             this.activeTab === 'signed' ? this.signedContracts :
                             this.unsignedContracts;

    if (contractsToExport.length === 0) {
      alert('No contracts to export.');
      return;
    }

    // Define CSV headers
    const headers = ['ID', 'Name', 'Date', 'Status', 'Type', 'Email'];

    // Convert contracts to CSV rows
    const rows = contractsToExport.map(contract => [
      contract.id,
      contract.client || contract.nom_contrat || '',
      new Date(contract.created_at || contract.startDate).toLocaleDateString(),
      contract.status || '',
      contract.type || '',
      contract.email_signataire || ''
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `contracts_${this.activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Refresh dashboard data
   */
  refreshData(): void {
    this.loadDashboardData();
  }

  /**
   * Delete contract
   */
  deleteContract(contract: any): void {
    console.log('Deleting contract:', contract);

    if (!confirm(`Are you sure you want to delete this contract: ${contract.client || contract.nom_contrat}?`)) {
      return;
    }

    this.isLoading = true;

    if (contract.type === 'unsigned') {
      // Delete unsigned contract
      this.unsignedContractService.deleteUnsignedContract(contract.id)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.isLoading = false)
        )
        .subscribe({
          next: (response) => {
            console.log('Unsigned contract deleted successfully:', response);
            alert('Contract deleted successfully.');
            // Reload dashboard data
            this.loadDashboardData();
          },
          error: (error) => {
            console.error('Error deleting unsigned contract:', error);
            alert('Failed to delete contract. Please try again.');
          }
        });
    }
  }


}